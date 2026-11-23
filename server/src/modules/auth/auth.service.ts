import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { AppError, BadRequest, Unauthorized } from '../../lib/errors.js';
import type { AuthUser, Role } from '../../middleware/auth.js';

// Sessions: login creates an AdminSession row; its id (`sid`) travels in the refresh token (the
// httpOnly cookie) and in every access token. requireAuth and /refresh check the row, so revoking it
// (logout, password change) or deactivating the user ends access immediately.

interface RefreshPayload {
  id: string;
  sid: string;
}

function signAccess(user: AuthUser) {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as never });
}
function signRefresh(payload: RefreshPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL as never });
}

// The refresh token's payload, or null when it is missing, forged, expired or from before sessions.
function readRefresh(token: string | undefined): RefreshPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as Partial<RefreshPayload>;
    return typeof decoded.id === 'string' && typeof decoded.sid === 'string'
      ? { id: decoded.id, sid: decoded.sid }
      : null;
  } catch {
    return null;
  }
}

// A bcrypt hash of nothing in particular: comparing against it when the email is unknown makes a
// failed login take as long as a wrong password, so the timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync(randomUUID(), 10);

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !ok) throw Unauthorized('Invalid credentials');

  const sid = randomUUID();
  const refreshToken = signRefresh({ id: user.id, sid });
  const { exp } = jwt.decode(refreshToken) as { exp: number };
  await prisma.$transaction([
    prisma.adminSession.create({ data: { id: sid, userId: user.id, expiresAt: new Date(exp * 1000) } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

  const payload: AuthUser = { id: user.id, role: user.role as Role, email: user.email, sid };
  return {
    accessToken: signAccess(payload),
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

// The user behind a live session, or null (unknown, revoked, expired, or the user was deactivated).
export async function liveSessionUser(sid: string, userId: string) {
  const session = await prisma.adminSession.findUnique({
    where: { id: sid },
    include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.userId !== userId ||
    !session.user.isActive
  ) {
    return null;
  }
  return session.user;
}

export async function refresh(token: string | undefined) {
  const decoded = readRefresh(token);
  if (!decoded) throw Unauthorized('Invalid refresh token');
  const user = await liveSessionUser(decoded.sid, decoded.id);
  if (!user) throw Unauthorized('Session has ended');
  await prisma.adminSession.update({ where: { id: decoded.sid }, data: { lastUsedAt: new Date() } });
  const payload: AuthUser = { id: user.id, role: user.role as Role, email: user.email, sid: decoded.sid };
  return { accessToken: signAccess(payload) };
}

// Ends the session the refresh cookie belongs to. Quietly does nothing for an invalid cookie.
export async function logout(token: string | undefined) {
  const decoded = readRefresh(token);
  if (!decoded) return;
  await prisma.adminSession.updateMany({
    where: { id: decoded.sid, userId: decoded.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function me(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw Unauthorized();
  return user;
}

// Change the signed-in user's own password. Requires the current one. Every other session of the
// user is ended (a stolen cookie stops working); the one making the change stays signed in.
export async function changePassword(
  id: string,
  currentSid: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive) throw Unauthorized();
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Current password is incorrect', 'WRONG_PASSWORD');
  }
  if (currentPassword === newPassword) {
    throw BadRequest('New password must differ from the current one');
  }
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const [, ended] = await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.adminSession.updateMany({
      where: { userId: id, revokedAt: null, id: { not: currentSid } },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: { actorId: id, action: 'PASSWORD_CHANGED', entity: 'User', entityId: id },
    }),
  ]);
  return { endedSessions: ended.count };
}

// Hourly clean-up: sessions that can no longer be used.
const KEEP_REVOKED_DAYS = 30;
export async function deleteDeadSessions(now = new Date()) {
  const res = await prisma.adminSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - KEEP_REVOKED_DAYS * 86_400_000) } },
      ],
    },
  });
  return res.count;
}

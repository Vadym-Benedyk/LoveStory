import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { Unauthorized } from '../../lib/errors.js';
import type { AuthUser } from '../../middleware/auth.js';

function signAccess(user: AuthUser) {
  return jwt.sign(user, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as never });
}
function signRefresh(user: Pick<AuthUser, 'id'>) {
  return jwt.sign(user, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_TTL as never });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw Unauthorized('Invalid credentials');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Unauthorized('Invalid credentials');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const payload: AuthUser = { id: user.id, role: user.role, email: user.email };
  return {
    accessToken: signAccess(payload),
    refreshToken: signRefresh({ id: user.id }),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function refresh(token: string) {
  let decoded: { id: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };
  } catch {
    throw Unauthorized('Invalid refresh token');
  }
  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user || !user.isActive) throw Unauthorized('User not found');
  const payload: AuthUser = { id: user.id, role: user.role, email: user.email };
  return { accessToken: signAccess(payload) };
}

export async function me(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) throw Unauthorized();
  return user;
}

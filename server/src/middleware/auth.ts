import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../lib/errors.js';
import { liveSessionUser } from '../modules/auth/auth.service.js';

// SQLite has no enums, so role is a String column. Keep a narrow union in app code.
export type Role = 'OWNER' | 'MANAGER' | 'EDITOR';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  sid: string; // AdminSession id (modules/auth/auth.service.ts)
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Require a valid access token (Bearer header) whose session is still live. The role and email
// come from the database, not the token, so a role change or deactivation applies at once.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(Unauthorized('Missing access token'));
  let claims: Partial<AuthUser>;
  try {
    claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as Partial<AuthUser>;
  } catch {
    return next(Unauthorized('Invalid or expired token'));
  }
  if (typeof claims.id !== 'string' || typeof claims.sid !== 'string') {
    return next(Unauthorized('Invalid or expired token'));
  }
  try {
    const user = await liveSessionUser(claims.sid, claims.id);
    if (!user) return next(Unauthorized('Session has ended'));
    req.user = { id: user.id, role: user.role as Role, email: user.email, sid: claims.sid };
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based guard. Use after requireAuth.
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) return next(Forbidden('Insufficient role'));
    next();
  };

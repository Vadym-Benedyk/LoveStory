import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { Forbidden, Unauthorized } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Require a valid access token (Bearer header).
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) return next(Unauthorized('Missing access token'));
  try {
    req.user = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthUser;
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
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

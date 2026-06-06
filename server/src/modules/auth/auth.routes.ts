import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rate-limit.js';
import { isProd } from '../../config/env.js';
import * as service from './auth.service.js';

export const authRouter = Router();

const REFRESH_COOKIE = 'lovestory_rt';
const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
  path: '/api/admin/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: z.object({ email: z.string().email(), password: z.string().min(1) }) }),
  asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, user } = await service.login(req.body.email, req.body.password);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    res.json({ accessToken, user });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    const { accessToken } = await service.refresh(token);
    res.json({ accessToken });
  }),
);

authRouter.post('/logout', (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await service.me(req.user!.id));
  }),
);

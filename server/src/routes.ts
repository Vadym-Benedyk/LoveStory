import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { publicBookingRouter, adminBookingRouter } from './modules/booking/booking.routes.js';
import { publicContentRouter, adminContentRouter } from './modules/content/content.routes.js';

export const apiRouter = Router();

// Health
apiRouter.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- Public API ----
apiRouter.use('/', publicContentRouter); // /content /gallery /promotions /reviews /pricing
apiRouter.use('/', publicBookingRouter); // /availability /quote /bookings

// ---- Admin API (guarded inside each router) ----
apiRouter.use('/admin/auth', authRouter);
apiRouter.use('/admin/bookings', adminBookingRouter);
apiRouter.use('/admin', adminContentRouter); // /admin/content /admin/settings

// Additional admin modules (media, promotions, pricing CRUD, reviews moderation) follow the
// same pattern — see docs/project-development-plan.md epics E6/E7.

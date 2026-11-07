import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { publicBookingRouter, adminBookingRouter } from './modules/booking/booking.routes.js';
import { publicContentRouter, adminContentRouter } from './modules/content/content.routes.js';
import { adminCalendarRouter } from './modules/calendar/calendar.routes.js';
import { adminMediaRouter } from './modules/media/media.routes.js';
import { adminPricingRouter } from './modules/pricing/pricing.routes.js';
import { adminReviewsRouter } from './modules/reviews/reviews.routes.js';
import { adminSettingsRouter } from './modules/settings/settings.routes.js';

export const apiRouter = Router();

// Health
apiRouter.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// ---- Public API ----
apiRouter.use('/', publicContentRouter); // /content /gallery /promotions /reviews /pricing
apiRouter.use('/', publicBookingRouter); // /availability /quote /bookings

// ---- Admin API (guarded inside each router) ----
apiRouter.use('/admin/auth', authRouter);
apiRouter.use('/admin/bookings', adminBookingRouter);
apiRouter.use('/admin/calendar', adminCalendarRouter); // /admin/calendar + /blocks
apiRouter.use('/admin/media', adminMediaRouter); // /admin/media (+ /upload, /reorder, /:id)
apiRouter.use('/admin/pricing', adminPricingRouter); // /admin/pricing (+ /rules, /addons)
apiRouter.use('/admin/reviews', adminReviewsRouter); // moderation: list, approve/hide/reply, delete
apiRouter.use('/admin/settings', adminSettingsRouter); // property, contacts, map, notifications
// Mounted on bare '/admin' with a router-level OWNER/EDITOR guard, so it must stay LAST:
// anything mounted after it would inherit that guard (e.g. a MANAGER would get 403).
apiRouter.use('/admin', adminContentRouter); // /admin/content

// Additional admin modules (promotions) follow the
// same pattern — see docs/project-development-plan.md epics E6/E7.

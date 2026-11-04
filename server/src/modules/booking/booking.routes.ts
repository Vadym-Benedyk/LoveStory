import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { bookingRequestLimiter, quoteLimiter } from '../../middleware/rate-limit.js';
import { toDateOnly } from '../../lib/dates.js';
import { getUnavailableRanges } from '../availability/availability.service.js';
import * as service from './booking.service.js';
import {
  adminCreateBookingSchema,
  availabilityQuerySchema,
  createBookingSchema,
  listBookingsQuerySchema,
  quoteSchema,
  updateNotesSchema,
  updateStatusSchema,
} from './booking.schema.js';

// ---- Public routes ----
export const publicBookingRouter = Router();

publicBookingRouter.get(
  '/availability',
  validate({ query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as { from: string; to: string };
    const ranges = await getUnavailableRanges(toDateOnly(from), toDateOnly(to));
    res.json({ unavailable: ranges });
  }),
);

publicBookingRouter.post(
  '/quote',
  quoteLimiter,
  validate({ body: quoteSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.quote(req.body));
  }),
);

publicBookingRouter.post(
  '/bookings',
  bookingRequestLimiter,
  validate({ body: createBookingSchema }),
  asyncHandler(async (req, res) => {
    const { booking, quote } = await service.createBookingRequest(req.body);
    res.status(201).json({
      reference: booking.reference,
      status: booking.status,
      message: 'Request received. The owner will call you to confirm. Nothing is booked yet.',
      quote,
    });
  }),
);

// ---- Admin routes ----
export const adminBookingRouter = Router();
adminBookingRouter.use(requireAuth, requireRole('OWNER', 'MANAGER'));

adminBookingRouter.get(
  '/',
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status, period } = req.query as { status?: string; period?: service.BookingPeriod };
    res.json(await service.listBookings(status, period));
  }),
);

// Manual booking by the owner/manager (phone or walk-in guest).
adminBookingRouter.post(
  '/',
  validate({ body: adminCreateBookingSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createManualBooking(req.body, req.user!.id));
  }),
);

adminBookingRouter.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const booking = await service.confirmBooking(id, req.user!.id);
    const conflicts = await service.flagConflictingPendings(
      booking.id,
      booking.checkIn,
      booking.checkOut,
    );
    res.json({ booking, conflictingPendingIds: conflicts });
  }),
);

// Manager's private note (editable from the booking details panel).
adminBookingRouter.patch(
  '/:id',
  validate({ body: updateNotesSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await service.updateInternalNotes(id, req.body.internalNotes, req.user!.id));
  }),
);

adminBookingRouter.patch(
  '/:id/status',
  validate({ body: updateStatusSchema }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const { status, internalNotes } = req.body;
    if (status === 'CONFIRMED') {
      const booking = await service.confirmBooking(id, req.user!.id);
      return res.json({ booking });
    }
    const booking = await service.setStatus(id, status, req.user!.id, internalNotes);
    res.json({ booking });
  }),
);

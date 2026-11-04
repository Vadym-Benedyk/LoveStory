import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { toDateOnly } from '../../lib/dates.js';
import * as service from './calendar.service.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const adminCalendarRouter = Router();
adminCalendarRouter.use(requireAuth, requireRole('OWNER', 'MANAGER'));

adminCalendarRouter.get(
  '/',
  validate({ query: z.object({ from: dateStr, to: dateStr }) }),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as { from: string; to: string };
    res.json(await service.getAdminCalendar(toDateOnly(from), toDateOnly(to)));
  }),
);

adminCalendarRouter.post(
  '/blocks',
  validate({
    body: z
      .object({ startDate: dateStr, endDate: dateStr, reason: z.string().max(200).optional() })
      .refine((d) => d.endDate > d.startDate, { message: 'Invalid range', path: ['endDate'] }),
  }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createBlock(req.body, req.user!.id));
  }),
);

adminCalendarRouter.delete(
  '/blocks/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await service.deleteBlock(id, req.user!.id));
  }),
);

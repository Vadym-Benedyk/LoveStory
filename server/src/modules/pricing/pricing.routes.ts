import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const RULE_KINDS = ['BASE', 'WEEKEND', 'SEASONAL', 'DATES'] as const;
const ADDON_UNITS = ['PER_STAY', 'PER_NIGHT', 'PER_PERSON'] as const;
const daysOfWeekCsv = z
  .string()
  .regex(/^$|^[0-6](,[0-6]){0,6}$/, 'Expected a comma-separated list of weekday numbers, e.g. "5,6"');
// DATES rules: CSV of calendar dates, e.g. "2026-12-25,2026-12-26,2027-04-04" (up to 100).
const datesCsv = z
  .string()
  .max(1100)
  .regex(/^$|^\d{4}-\d{2}-\d{2}(,\d{4}-\d{2}-\d{2})*$/, 'Expected comma-separated YYYY-MM-DD dates');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const adminPricingRouter = Router();
// Pricing affects revenue directly — owner-only (see docs/product-design.md role table).
adminPricingRouter.use(requireAuth, requireRole('OWNER'));

adminPricingRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [rules, addons, included] = await Promise.all([
      prisma.priceRule.findMany({ orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }] }),
      prisma.addon.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.includedItem.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    res.json({ rules, addons, included });
  }),
);

// ---- Price rules ----
// Names are stored in both site languages: `name` = Ukrainian (default), `nameEn` = English.
const ruleObject = z.object({
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  kind: z.enum(RULE_KINDS),
  nightlyRateMinor: z.number().int().min(0),
  currency: z.string().min(1).max(8).default(env.DEFAULT_CURRENCY),
  appliesFrom: dateStr.optional().nullable(),
  appliesTo: dateStr.optional().nullable(),
  daysOfWeek: daysOfWeekCsv.default(''),
  dates: datesCsv.default(''),
  minNights: z.number().int().min(1).optional().nullable(),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// appliesFrom/appliesTo arrive as "YYYY-MM-DD" strings; Prisma needs real Date objects.
function withParsedDates<T extends { appliesFrom?: string | null; appliesTo?: string | null }>(
  body: T,
) {
  return {
    ...body,
    ...(body.appliesFrom !== undefined && {
      appliesFrom: body.appliesFrom ? new Date(body.appliesFrom) : null,
    }),
    ...(body.appliesTo !== undefined && {
      appliesTo: body.appliesTo ? new Date(body.appliesTo) : null,
    }),
  };
}

adminPricingRouter.post(
  '/rules',
  validate({ body: ruleObject }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await prisma.priceRule.create({ data: withParsedDates(req.body) }));
  }),
);

adminPricingRouter.patch(
  '/rules/:id',
  validate({ body: ruleObject.partial() }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await prisma.priceRule.update({ where: { id }, data: withParsedDates(req.body) }));
  }),
);

adminPricingRouter.delete(
  '/rules/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await prisma.priceRule.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

// ---- Add-ons ----
const addonBody = z.object({
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  descriptionEn: z.string().trim().max(500).optional().nullable(),
  priceMinor: z.number().int().min(0),
  currency: z.string().min(1).max(8).default(env.DEFAULT_CURRENCY),
  unit: z.enum(ADDON_UNITS).default('PER_STAY'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

adminPricingRouter.post(
  '/addons',
  validate({ body: addonBody }),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof addonBody>;
    if (data.sortOrder == null) {
      const last = await prisma.addon.findFirst({ orderBy: { sortOrder: 'desc' } });
      data.sortOrder = (last?.sortOrder ?? -1) + 1;
    }
    res.status(201).json(await prisma.addon.create({ data }));
  }),
);

adminPricingRouter.patch(
  '/addons/:id',
  validate({ body: addonBody.partial() }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await prisma.addon.update({ where: { id }, data: req.body }));
  }),
);

adminPricingRouter.delete(
  '/addons/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await prisma.addon.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

// ---- "What's included in the price" items ----
const includedBody = z.object({
  name: z.string().trim().min(1).max(120),
  nameEn: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(40).default('check'),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
});

adminPricingRouter.post(
  '/included',
  validate({ body: includedBody }),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof includedBody>;
    if (data.sortOrder == null) {
      const last = await prisma.includedItem.findFirst({ orderBy: { sortOrder: 'desc' } });
      data.sortOrder = (last?.sortOrder ?? -1) + 1;
    }
    res.status(201).json(await prisma.includedItem.create({ data }));
  }),
);

adminPricingRouter.patch(
  '/included/:id',
  validate({ body: includedBody.partial() }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await prisma.includedItem.update({ where: { id }, data: req.body }));
  }),
);

adminPricingRouter.delete(
  '/included/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    await prisma.includedItem.delete({ where: { id } });
    res.json({ ok: true });
  }),
);

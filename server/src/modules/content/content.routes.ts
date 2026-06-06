import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { publicWriteLimiter } from '../../middleware/rate-limit.js';
import { prisma } from '../../lib/prisma.js';

// ---- Public read routes for marketing content ----
export const publicContentRouter = Router();

publicContentRouter.get(
  '/content',
  asyncHandler(async (_req, res) => {
    const [blocks, settings] = await Promise.all([
      prisma.contentBlock.findMany(),
      prisma.siteSettings.findUnique({ where: { id: 'default' } }),
    ]);
    const copy = Object.fromEntries(blocks.map((b) => [b.key, b.value]));
    res.json({ copy, settings });
  }),
);

publicContentRouter.get(
  '/gallery',
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.media.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    );
  }),
);

publicContentRouter.get(
  '/promotions',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    res.json(
      await prisma.promotion.findMany({
        where: {
          isActive: true,
          OR: [{ validTo: null }, { validTo: { gte: now } }],
        },
        orderBy: { sortOrder: 'asc' },
        include: { imageMedia: true },
      }),
    );
  }),
);

publicContentRouter.get(
  '/reviews',
  asyncHandler(async (_req, res) => {
    const reviews = await prisma.review.findMany({
      where: { status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
    const avg = reviews.length
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
    res.json({ reviews, summary: { count: reviews.length, average: avg } });
  }),
);

publicContentRouter.get(
  '/pricing',
  asyncHandler(async (_req, res) => {
    const [rules, addons] = await Promise.all([
      prisma.priceRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
      prisma.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    res.json({ rules, addons });
  }),
);

publicContentRouter.post(
  '/reviews',
  publicWriteLimiter,
  validate({
    body: z.object({
      authorName: z.string().min(2).max(120),
      rating: z.coerce.number().int().min(1).max(5),
      title: z.string().max(160).optional(),
      body: z.string().min(5).max(2000),
      stayMonth: z.string().max(40).optional(),
      website: z.string().max(0).optional(), // honeypot
    }),
  }),
  asyncHandler(async (req, res) => {
    const { website, ...data } = req.body;
    const review = await prisma.review.create({ data: { ...data, status: 'PENDING' } });
    res.status(201).json({ id: review.id, status: review.status, message: 'Thanks! Your review is pending moderation.' });
  }),
);

// ---- Admin content/settings editing (pattern; extend per docs/product-design §1) ----
export const adminContentRouter = Router();
adminContentRouter.use(requireAuth, requireRole('OWNER', 'EDITOR'));

adminContentRouter.put(
  '/content',
  validate({ body: z.object({ blocks: z.array(z.object({ key: z.string(), value: z.string() })) }) }),
  asyncHandler(async (req, res) => {
    const { blocks } = req.body as { blocks: { key: string; value: string }[] };
    await prisma.$transaction(
      blocks.map((b) =>
        prisma.contentBlock.upsert({
          where: { key_locale: { key: b.key, locale: 'en' } },
          update: { value: b.value, updatedById: req.user!.id },
          create: { key: b.key, locale: 'en', value: b.value, updatedById: req.user!.id },
        }),
      ),
    );
    res.json({ ok: true });
  }),
);

adminContentRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await prisma.siteSettings.update({ where: { id: 'default' }, data: req.body });
    res.json(settings);
  }),
);

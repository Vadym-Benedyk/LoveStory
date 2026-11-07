import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { reviewSubmitLimiter } from '../../middleware/rate-limit.js';
import { prisma } from '../../lib/prisma.js';
import { toPublicSettings } from '../settings/settings.routes.js';
import { readHeroOverlay } from '../media/hero-overlay.js';

// Locales the site supports (kept in sync with client/src/i18n/translations.ts: Lang).
const LOCALES = ['uk', 'en'] as const;
const DEFAULT_LOCALE = 'uk';

// ---- Public read routes for marketing content ----
export const publicContentRouter = Router();

publicContentRouter.get(
  '/content',
  validate({ query: z.object({ locale: z.enum(LOCALES).optional() }) }),
  asyncHandler(async (req, res) => {
    const locale = (req.query.locale as string | undefined) ?? DEFAULT_LOCALE;
    const [blocks, settings] = await Promise.all([
      prisma.contentBlock.findMany({ where: { locale } }),
      prisma.siteSettings.findUnique({ where: { id: 'default' } }),
    ]);
    const copy = Object.fromEntries(blocks.map((b) => [b.key, b.value]));
    res.json({ locale, copy, settings: toPublicSettings(settings) });
  }),
);

// The home-page splash and the gallery are separate: `hero` is the single splash photo (or null),
// `photos` are the gallery photos and never include it. `heroOverlay` (0–100, 80 = standard) is how dark the layer
// over the splash is, sent with it so the photo and its darkening are applied together.
publicContentRouter.get(
  '/gallery',
  asyncHandler(async (_req, res) => {
    const [hero, photos, heroOverlay] = await Promise.all([
      prisma.media.findFirst({ where: { isActive: true, isHero: true } }),
      prisma.media.findMany({
        where: { isActive: true, isHero: false },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      readHeroOverlay(),
    ]);
    res.json({ hero, photos, heroOverlay });
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
      // Public shape only — no moderation fields (status, approvedById, source).
      select: {
        id: true,
        authorName: true,
        rating: true,
        title: true,
        body: true,
        stayMonth: true,
        ownerReply: true,
        createdAt: true,
      },
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
    const [rules, addons, included] = await Promise.all([
      prisma.priceRule.findMany({ where: { isActive: true }, orderBy: { priority: 'desc' } }),
      prisma.addon.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.includedItem.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    res.json({ rules, addons, included });
  }),
);

publicContentRouter.post(
  '/reviews',
  reviewSubmitLimiter,
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

// ---- Admin content editing (pattern; extend per docs/product-design §1) ----
export const adminContentRouter = Router();
adminContentRouter.use(requireAuth, requireRole('OWNER', 'EDITOR'));

adminContentRouter.get(
  '/content',
  validate({ query: z.object({ locale: z.enum(LOCALES).optional() }) }),
  asyncHandler(async (req, res) => {
    const locale = (req.query.locale as string | undefined) ?? DEFAULT_LOCALE;
    const blocks = await prisma.contentBlock.findMany({
      where: { locale },
      orderBy: { key: 'asc' },
    });
    res.json({ locale, blocks });
  }),
);

adminContentRouter.put(
  '/content',
  validate({
    body: z.object({
      locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
      blocks: z.array(z.object({ key: z.string().min(1).max(120), value: z.string().max(60000) })),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { locale, blocks } = req.body as { locale: string; blocks: { key: string; value: string }[] };
    await prisma.$transaction(
      blocks.map((b) =>
        prisma.contentBlock.upsert({
          where: { key_locale: { key: b.key, locale } },
          update: { value: b.value, updatedById: req.user!.id },
          create: { key: b.key, locale, value: b.value, updatedById: req.user!.id },
        }),
      ),
    );
    res.json({ ok: true });
  }),
);

adminContentRouter.delete(
  '/content/:key',
  validate({
    params: z.object({ key: z.string().min(1) }),
    query: z.object({ locale: z.enum(LOCALES).optional() }),
  }),
  asyncHandler(async (req, res) => {
    const key = req.params.key as string;
    const locale = (req.query.locale as string | undefined) ?? DEFAULT_LOCALE;
    await prisma.contentBlock.delete({ where: { key_locale: { key, locale } } }).catch(() => null);
    res.json({ ok: true });
  }),
);

// Settings moved to modules/settings (validated, owner-only).

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { buildMediaKey, deleteObject, isStorageConfigured, presignUpload, publicUrlFor } from '../../lib/storage.js';

const CATEGORIES = ['HOUSE', 'RIVER', 'BBQ', 'TUB', 'NATURE', 'OTHER'] as const;
const MEDIA_TYPES = ['IMAGE', 'VIDEO'] as const;

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAuth, requireRole('OWNER', 'EDITOR'));

adminMediaRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(
      await prisma.media.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }),
    );
  }),
);

adminMediaRouter.post(
  '/presign',
  validate({
    body: z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().regex(/^image\/[a-z0-9.+-]+$/i, 'Only image uploads are supported'),
      category: z.enum(CATEGORIES).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      return res.status(503).json({
        error: 'Object storage is not configured. Set S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY.',
      });
    }
    const { filename, contentType, category } = req.body as {
      filename: string;
      contentType: string;
      category?: string;
    };
    const key = buildMediaKey(category ?? 'other', filename);
    const uploadUrl = await presignUpload(key, contentType);
    res.json({ key, uploadUrl, publicUrl: publicUrlFor(key) });
  }),
);

adminMediaRouter.post(
  '/',
  validate({
    body: z.object({
      storageKey: z.string().min(1),
      url: z.string().min(1),
      type: z.enum(MEDIA_TYPES).default('IMAGE'),
      title: z.string().max(160).optional(),
      altText: z.string().min(1).max(300),
      category: z.enum(CATEGORIES).default('OTHER'),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      isHero: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = req.body as {
      storageKey: string;
      url: string;
      type: string;
      title?: string;
      altText: string;
      category: string;
      width?: number;
      height?: number;
      isHero: boolean;
    };
    const last = await prisma.media.findFirst({ orderBy: { sortOrder: 'desc' } });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const created = await prisma.$transaction(async (tx) => {
      if (data.isHero) await tx.media.updateMany({ data: { isHero: false }, where: { isHero: true } });
      return tx.media.create({ data: { ...data, sortOrder } });
    });
    res.status(201).json(created);
  }),
);

adminMediaRouter.patch(
  '/:id',
  validate({
    body: z.object({
      title: z.string().max(160).optional(),
      altText: z.string().min(1).max(300).optional(),
      category: z.enum(CATEGORIES).optional(),
      isActive: z.boolean().optional(),
      isHero: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const data = req.body as Record<string, unknown>;
    const updated = await prisma.$transaction(async (tx) => {
      if (data.isHero === true) {
        await tx.media.updateMany({ data: { isHero: false }, where: { isHero: true } });
      }
      return tx.media.update({ where: { id }, data });
    });
    res.json(updated);
  }),
);

adminMediaRouter.post(
  '/reorder',
  validate({
    body: z.object({
      items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { items } = req.body as { items: { id: string; sortOrder: number }[] };
    await prisma.$transaction(
      items.map((i) => prisma.media.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })),
    );
    res.json({ ok: true });
  }),
);

adminMediaRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return res.status(404).json({ error: 'Not found' });
    await prisma.media.delete({ where: { id } });
    // Best-effort: don't fail the request if the object is already gone from storage.
    if (isStorageConfigured()) {
      await deleteObject(media.storageKey).catch(() => null);
    }
    res.json({ ok: true });
  }),
);

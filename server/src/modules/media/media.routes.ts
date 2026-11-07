import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { AppError } from '../../lib/errors.js';
import { sniffImage } from '../../lib/image-type.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { readHeroOverlay, writeHeroOverlay } from './hero-overlay.js';
import { buildMediaKey, deleteObject, isStorageConfigured, publicUrlFor, putObject } from '../../lib/storage.js';

const CATEGORIES = ['HOUSE', 'RIVER', 'BBQ', 'TUB', 'NATURE', 'OTHER'] as const;

// Keep in sync with the "too large" message in the client i18n (admin.gallery.tooLarge).
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// The photo is the raw request body (Content-Type: image/*); its details travel in the query
// string. One photo per request, buffered in memory (capped by MAX_UPLOAD_BYTES).
const rawImageBody = (req: Request, res: Response, next: NextFunction) =>
  express.raw({ type: 'image/*', limit: MAX_UPLOAD_BYTES })(req, res, (err?: unknown) => {
    if ((err as { type?: string } | undefined)?.type === 'entity.too.large') {
      return next(new AppError(413, 'Photo is too large (max 15 MB)', 'FILE_TOO_LARGE'));
    }
    next(err);
  });

export const adminMediaRouter = Router();
adminMediaRouter.use(requireAuth, requireRole('OWNER', 'EDITOR'));

// Same order as the public site (sortOrder, then upload time), so the admin shows the gallery
// the way guests see it and the move up/down buttons do what they say.
adminMediaRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.media.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }));
  }),
);

// Darkening over the splash photo (0–100 slider, 80 = standard). Shared by all languages.
adminMediaRouter.get(
  '/hero-overlay',
  asyncHandler(async (_req, res) => {
    res.json({ value: await readHeroOverlay() });
  }),
);

adminMediaRouter.put(
  '/hero-overlay',
  validate({ body: z.object({ value: z.number().int().min(0).max(100) }) }),
  asyncHandler(async (req, res) => {
    const { value } = req.body as { value: number };
    await writeHeroOverlay(value, req.user!.id);
    res.json({ value });
  }),
);

adminMediaRouter.post(
  '/upload',
  rawImageBody,
  validate({
    query: z.object({
      category: z.enum(CATEGORIES).default('OTHER'),
      filename: z.string().max(200).optional(), // original name → default alt text
      width: z.coerce.number().int().positive().optional(),
      height: z.coerce.number().int().positive().optional(),
      // true → this photo is the home-page splash (kept apart from the gallery), replacing the current one
      isHero: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!isStorageConfigured()) {
      throw new AppError(
        503,
        'Object storage is not configured. Set S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY, or use STORAGE_DRIVER=local.',
        'STORAGE_NOT_CONFIGURED',
      );
    }
    const { category, filename, width, height, isHero } = req.query as unknown as {
      category: (typeof CATEGORIES)[number];
      filename?: string;
      width?: number;
      height?: number;
      isHero: boolean;
    };

    // The body is only a Buffer when the Content-Type was image/*; the real type comes from the bytes.
    const body: unknown = req.body;
    const kind = Buffer.isBuffer(body) ? sniffImage(body) : null;
    if (!Buffer.isBuffer(body) || !kind) {
      throw new AppError(415, 'Unsupported file. Upload a JPEG, PNG, WebP or AVIF image.', 'UNSUPPORTED_MEDIA_TYPE');
    }

    const key = buildMediaKey(category, kind.ext);
    await putObject(key, body, kind.mime);

    try {
      let replacedKeys: string[] = [];
      const created = await prisma.$transaction(async (tx) => {
        if (isHero) {
          // The home-page splash is its own single slot, separate from the gallery: a new one
          // replaces — and deletes — the old one (it must not drop into the gallery).
          const old = await tx.media.findMany({ where: { isHero: true }, select: { storageKey: true } });
          await tx.media.deleteMany({ where: { isHero: true } });
          replacedKeys = old.map((o) => o.storageKey);
        }
        const last = await tx.media.findFirst({ orderBy: { sortOrder: 'desc' } });
        return tx.media.create({
          data: {
            storageKey: key,
            url: publicUrlFor(key),
            type: 'IMAGE',
            // Alt text is required; start from the file name and let the admin refine it.
            altText: filename?.replace(/\.[^./]+$/, '').trim().slice(0, 300) || 'Photo',
            category,
            width,
            height,
            isHero,
            sortOrder: (last?.sortOrder ?? -1) + 1,
          },
        });
      });
      // Best-effort, like on delete: the replaced splash's file is no longer referenced.
      await Promise.all(replacedKeys.map((k) => deleteObject(k).catch(() => null)));
      res.status(201).json(created);
    } catch (err) {
      // Don't leave an orphaned file behind if the row could not be saved.
      await deleteObject(key).catch(() => null);
      throw err;
    }
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
      sortOrder: z.number().int().optional(),
    }),
  }),
  // The splash is set by uploading with ?isHero=true and removed with DELETE, so `isHero` is
  // deliberately not editable here (a gallery photo can't silently turn into the splash).
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    res.json(await prisma.media.update({ where: { id }, data: req.body }));
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

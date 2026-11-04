import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';

// Review moderation. Nothing is public until APPROVED (public GET /reviews filters on it).
export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'] as const;

export const adminReviewsRouter = Router();
// Moderation is an OWNER + MANAGER task (docs/product-design.md role table).
adminReviewsRouter.use(requireAuth, requireRole('OWNER', 'MANAGER'));

adminReviewsRouter.get(
  '/',
  validate({ query: z.object({ status: z.enum(REVIEW_STATUSES).optional() }) }),
  asyncHandler(async (req, res) => {
    const status = req.query.status as (typeof REVIEW_STATUSES)[number] | undefined;
    const [reviews, grouped] = await Promise.all([
      prisma.review.findMany({
        where: status ? { status } : {},
        // Pending first so the queue is on top in the "all" view, newest first within.
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(REVIEW_STATUSES.map((s) => [s, 0])) as Record<
      (typeof REVIEW_STATUSES)[number],
      number
    >;
    for (const g of grouped) {
      if (g.status in counts) counts[g.status as keyof typeof counts] = g._count._all;
    }
    res.json({ reviews, counts });
  }),
);

const patchBody = z
  .object({
    status: z.enum(REVIEW_STATUSES).optional(),
    // Empty string / null clears the reply.
    ownerReply: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((b) => b.status !== undefined || b.ownerReply !== undefined, {
    message: 'Nothing to update',
  });

adminReviewsRouter.patch(
  '/:id',
  validate({ body: patchBody }),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const body = req.body as z.infer<typeof patchBody>;
    const actorId = req.user!.id;

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw NotFound('Review not found');

    const data: {
      status?: string;
      approvedAt?: Date | null;
      approvedById?: string | null;
      ownerReply?: string | null;
    } = {};
    if (body.status && body.status !== existing.status) {
      data.status = body.status;
      // approvedAt/By describe the current approval; reset when it is withdrawn.
      if (body.status === 'APPROVED') {
        data.approvedAt = new Date();
        data.approvedById = actorId;
      } else {
        data.approvedAt = null;
        data.approvedById = null;
      }
    }
    if (body.ownerReply !== undefined) data.ownerReply = body.ownerReply || null;

    const updated = await prisma.review.update({ where: { id }, data });

    const actions: string[] = [];
    if (data.status) actions.push(`REVIEW_${data.status}`);
    if (data.ownerReply !== undefined && data.ownerReply !== existing.ownerReply) {
      actions.push(data.ownerReply ? 'REVIEW_REPLIED' : 'REVIEW_REPLY_REMOVED');
    }
    if (actions.length) {
      await prisma.auditLog.createMany({
        data: actions.map((action) => ({ actorId, action, entity: 'Review', entityId: id })),
      });
    }
    res.json(updated);
  }),
);

adminReviewsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) throw NotFound('Review not found');
    await prisma.review.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'REVIEW_DELETED',
        entity: 'Review',
        entityId: id,
        // Keep enough to know what was removed; the row itself is gone.
        meta: JSON.stringify({ authorName: existing.authorName, rating: existing.rating }),
      },
    });
    res.json({ ok: true });
  }),
);

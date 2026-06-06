import { customAlphabet } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { toDateOnly } from '../../lib/dates.js';
import { buildQuote, type QuoteAddonInput } from '../pricing/pricing.engine.js';
import { getOverlappingPending, isRangeAvailable } from '../availability/availability.service.js';
import type { CreateBookingInput, QuoteInput } from './booking.schema.js';

const refCode = customAlphabet('ACDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

async function loadPricingInputs(input: { promotionSlug?: string; addons: { addonId: string; quantity: number }[] }) {
  const [rules, addonRows, promotion] = await Promise.all([
    prisma.priceRule.findMany({ where: { isActive: true } }),
    input.addons.length
      ? prisma.addon.findMany({ where: { id: { in: input.addons.map((a) => a.addonId) }, isActive: true } })
      : Promise.resolve([]),
    input.promotionSlug
      ? prisma.promotion.findFirst({ where: { slug: input.promotionSlug, isActive: true } })
      : Promise.resolve(null),
  ]);

  const addonInputs: QuoteAddonInput[] = input.addons
    .map((a) => {
      const addon = addonRows.find((r) => r.id === a.addonId);
      return addon ? { addon, quantity: a.quantity } : null;
    })
    .filter((x): x is QuoteAddonInput => x !== null);

  return { rules, addonInputs, promotion };
}

export async function quote(input: QuoteInput) {
  const checkIn = toDateOnly(input.checkIn);
  const checkOut = toDateOnly(input.checkOut);
  if (checkIn < toDateOnly(new Date())) throw BadRequest('Check-in cannot be in the past');

  const { rules, addonInputs, promotion } = await loadPricingInputs(input);
  return buildQuote({
    checkIn,
    checkOut,
    rules,
    addons: addonInputs,
    promotion,
    currency: env.DEFAULT_CURRENCY,
  });
}

export async function createBookingRequest(input: CreateBookingInput) {
  const checkIn = toDateOnly(input.checkIn);
  const checkOut = toDateOnly(input.checkOut);
  if (checkIn < toDateOnly(new Date())) throw BadRequest('Check-in cannot be in the past');

  // Re-check availability server-side (client view is only a hint).
  const available = await isRangeAvailable(checkIn, checkOut);
  if (!available) throw Conflict('These dates are no longer available');

  const { rules, addonInputs, promotion } = await loadPricingInputs(input);
  const q = buildQuote({
    checkIn,
    checkOut,
    rules,
    addons: addonInputs,
    promotion,
    currency: env.DEFAULT_CURRENCY,
  });
  if (!q.meetsMinNights) {
    throw BadRequest(`Minimum stay is ${q.minNights} nights for the selected dates`);
  }

  const booking = await prisma.booking.create({
    data: {
      reference: refCode(),
      guestName: input.guestName,
      guestPhone: input.guestPhone,
      guestEmail: input.guestEmail,
      guestsCount: input.guestsCount,
      checkIn,
      checkOut,
      status: 'PENDING',
      source: 'WEBSITE',
      priceQuoteMinor: q.totalMinor,
      currency: q.currency,
      comments: input.comments,
      appliedPromotionId: promotion?.id,
      addons: {
        create: addonInputs.map((a) => ({
          addonId: a.addon.id,
          quantity: a.quantity,
          unitPriceMinor: a.addon.priceMinor,
        })),
      },
    },
  });

  return { booking, quote: q };
}

// Manual confirmation — transactional, re-checks availability to prevent double-confirm.
export async function confirmBooking(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id } });
    if (!booking) throw NotFound('Booking not found');
    if (booking.status !== 'PENDING') throw Conflict(`Cannot confirm a ${booking.status} booking`);

    const free = await isRangeAvailable(booking.checkIn, booking.checkOut, { tx: tx as never });
    if (!free) throw Conflict('Dates already taken by another confirmed booking');

    const updated = await tx.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actorId },
    });

    await tx.auditLog.create({
      data: { actorId, action: 'BOOKING_CONFIRMED', entity: 'Booking', entityId: id },
    });
    return updated;
  });
  // Note: the DB also enforces a btree_gist exclusion constraint on CONFIRMED ranges
  // as a last line of defense (see migration). Overlapping pendings are flagged below.
}

export async function flagConflictingPendings(bookingId: string, checkIn: Date, checkOut: Date) {
  const overlaps = await getOverlappingPending(checkIn, checkOut, bookingId);
  return overlaps.map((p) => p.id); // controller can surface these to the admin UI
}

export async function setStatus(
  id: string,
  status: 'DECLINED' | 'CANCELLED',
  actorId: string,
  internalNotes?: string,
) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) throw NotFound('Booking not found');
  const updated = await prisma.booking.update({
    where: { id },
    data: { status, internalNotes: internalNotes ?? booking.internalNotes },
  });
  await prisma.auditLog.create({
    data: { actorId, action: `BOOKING_${status}`, entity: 'Booking', entityId: id },
  });
  return updated;
}

export async function listBookings(status?: string) {
  return prisma.booking.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: 'desc' },
    include: { addons: { include: { addon: true } }, appliedPromotion: true },
  });
}

// Expire stale pending requests (called by cron).
export async function expireStalePending() {
  const cutoff = new Date(Date.now() - env.PENDING_EXPIRY_DAYS * 86_400_000);
  const res = await prisma.booking.updateMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    data: { status: 'EXPIRED' },
  });
  return res.count;
}

import { customAlphabet } from 'nanoid';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { toDateOnly } from '../../lib/dates.js';
import { adminRequestsUrl, notifyNewRequest } from '../../lib/notify.js';
import { buildQuote, type QuoteAddonInput } from '../pricing/pricing.engine.js';
import { getOverlappingPending, isRangeAvailable } from '../availability/availability.service.js';
import type { AdminCreateBookingInput, CreateBookingInput, QuoteInput } from './booking.schema.js';

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

  // More guests than the house's capacity (admin Settings) is accepted on purpose — the form
  // offers up to 6 — and flagged for the owner, who settles it on the confirmation call.
  const settings = await prisma.siteSettings.findUnique({
    where: { id: 'default' },
    select: { capacity: true },
  });
  const capacity = settings?.capacity ?? null;

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

  // Fire-and-forget: the guest gets their reference immediately; channel retries/failures
  // are handled and logged inside notifyNewRequest (it never rejects).
  void notifyNewRequest({
    reference: booking.reference,
    guestName: booking.guestName,
    guestPhone: booking.guestPhone,
    guestEmail: booking.guestEmail,
    guestsCount: booking.guestsCount,
    capacity,
    checkIn,
    checkOut,
    nights: q.nights,
    totalMinor: q.totalMinor,
    currency: q.currency,
    addons: addonInputs.map((a) => ({ name: a.addon.name, quantity: a.quantity })),
    comments: booking.comments,
    adminUrl: adminRequestsUrl(),
  });

  return { booking, quote: q };
}

// Admin "new booking" for guests who called / wrote directly (source = MANUAL).
// - Price: rules-based quote unless the owner sets priceMinor (e.g. a discount agreed by phone).
// - CONFIRMED (default): created inside a transaction with the same overlap check as
//   confirmBooking, so it can never double-book. PENDING: still refused on taken dates.
// - No owner notification (the owner made it); min-stay rules are not enforced here.
export async function createManualBooking(input: AdminCreateBookingInput, actorId: string) {
  const checkIn = toDateOnly(input.checkIn);
  const checkOut = toDateOnly(input.checkOut);
  if (checkIn < toDateOnly(new Date())) throw BadRequest('Check-in cannot be in the past');

  const { rules } = await loadPricingInputs({ addons: [] });
  const q = buildQuote({ checkIn, checkOut, rules, currency: env.DEFAULT_CURRENCY });
  const priceQuoteMinor = input.priceMinor ?? q.totalMinor;
  const confirmed = input.status === 'CONFIRMED';

  const booking = await prisma.$transaction(async (tx) => {
    const free = await isRangeAvailable(checkIn, checkOut, { tx: tx as never });
    if (!free) throw Conflict('These dates are already taken');

    const created = await tx.booking.create({
      data: {
        reference: refCode(),
        guestName: input.guestName,
        guestPhone: input.guestPhone,
        guestEmail: input.guestEmail,
        guestsCount: input.guestsCount,
        checkIn,
        checkOut,
        status: input.status,
        source: 'MANUAL',
        priceQuoteMinor,
        currency: q.currency,
        internalNotes: input.internalNotes,
        ...(confirmed ? { confirmedAt: new Date(), confirmedById: actorId } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'BOOKING_CREATED_MANUAL',
        entity: 'Booking',
        entityId: created.id,
        meta: JSON.stringify({
          status: input.status,
          quotedMinor: q.totalMinor,
          priceMinor: priceQuoteMinor,
        }),
      },
    });
    return created;
  });

  // Website requests waiting on these dates now clash with a confirmed stay → flag for the owner.
  const conflictingPendingIds = confirmed
    ? await flagConflictingPendings(booking.id, checkIn, checkOut)
    : [];
  return { booking, quotedMinor: q.totalMinor, conflictingPendingIds };
}

// Statuses an admin can confirm from: a waiting request, or a declined one the owner changed
// their mind about (circumstances changed). Expired/cancelled stays are not revived here.
const CONFIRMABLE_FROM = ['PENDING', 'DECLINED'];

// Manual confirmation — transactional, re-checks availability to prevent double-confirm.
export async function confirmBooking(id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id } });
    if (!booking) throw NotFound('Booking not found');
    if (!CONFIRMABLE_FROM.includes(booking.status)) {
      throw Conflict(`Cannot confirm a ${booking.status} booking`);
    }

    const free = await isRangeAvailable(booking.checkIn, booking.checkOut, { tx: tx as never });
    if (!free) throw Conflict('Dates already taken by another confirmed booking');

    const updated = await tx.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: actorId },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'BOOKING_CONFIRMED',
        entity: 'Booking',
        entityId: id,
        meta: JSON.stringify({ from: booking.status }),
      },
    });
    return updated;
  });
  // SQLite has no exclusion constraints: this transaction is the only overlap guard for
  // CONFIRMED ranges (the old Postgres btree_gist constraint is gone). Overlapping pendings
  // are flagged below.
}

export async function flagConflictingPendings(bookingId: string, checkIn: Date, checkOut: Date) {
  const overlaps = await getOverlappingPending(checkIn, checkOut, bookingId);
  return overlaps.map((p) => p.id); // controller can surface these to the admin UI
}

// Allowed admin transitions (docs/product-design.md §4). CONFIRMED goes through confirmBooking;
// EXPIRED is set only by the expiry job.
const ALLOWED_FROM: Record<'DECLINED' | 'CANCELLED', string> = {
  DECLINED: 'PENDING', // a request that was never accepted
  CANCELLED: 'CONFIRMED', // an accepted stay that falls through → reopens the dates
};

export async function setStatus(
  id: string,
  status: 'DECLINED' | 'CANCELLED',
  actorId: string,
  internalNotes?: string,
) {
  const from = ALLOWED_FROM[status];
  // Conditional update = atomic check-and-set: a concurrent confirm/decline can't be overwritten.
  const res = await prisma.booking.updateMany({
    where: { id, status: from },
    data: { status, ...(internalNotes !== undefined ? { internalNotes } : {}) },
  });
  if (res.count === 0) {
    const current = await prisma.booking.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw NotFound('Booking not found');
    throw Conflict(`Cannot change a ${current.status} booking to ${status}`);
  }
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId, action: `BOOKING_${status}`, entity: 'Booking', entityId: id },
  });
  return updated;
}

export type BookingPeriod = 'day' | 'week' | 'month' | 'year';

// Calendar window containing `now`, as a half-open range [from, to) of UTC dates:
// day = today, week = Monday–Sunday, month = calendar month, year = calendar year.
export function periodRange(period: BookingPeriod, now = new Date()): { from: Date; to: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (period === 'day') return { from: new Date(Date.UTC(y, m, d)), to: new Date(Date.UTC(y, m, d + 1)) };
  if (period === 'week') {
    const sinceMonday = (now.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const from = new Date(Date.UTC(y, m, d - sinceMonday));
    return { from, to: new Date(Date.UTC(y, m, d - sinceMonday + 7)) };
  }
  if (period === 'month') return { from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) };
  return { from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) };
}

// Optional filters: status, and period = bookings whose CHECK-IN date falls in the current
// week / month / year. Always sorted by check-in date (earliest first); ties: newest request first.
export async function listBookings(status?: string, period?: BookingPeriod) {
  const range = period ? periodRange(period) : null;
  return prisma.booking.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(range ? { checkIn: { gte: range.from, lt: range.to } } : {}),
    },
    orderBy: [{ checkIn: 'asc' }, { createdAt: 'desc' }],
    include: {
      addons: { include: { addon: true } },
      appliedPromotion: true,
      confirmedBy: { select: { name: true, email: true } },
    },
  });
}

// Manager's private note on a booking (not shown to the guest). '' / null clears it.
export async function updateInternalNotes(id: string, internalNotes: string | null, actorId: string) {
  const existing = await prisma.booking.findUnique({ where: { id }, select: { internalNotes: true } });
  if (!existing) throw NotFound('Booking not found');
  const value = internalNotes?.trim() || null;
  const updated = await prisma.booking.update({ where: { id }, data: { internalNotes: value } });
  if (value !== existing.internalNotes) {
    await prisma.auditLog.create({
      data: { actorId, action: 'BOOKING_NOTES_UPDATED', entity: 'Booking', entityId: id },
    });
  }
  return updated;
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

import { z } from 'zod';
import { normalizePhone } from '../../lib/phone.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// Public limits on a stay. The price is worked out night by night (pricing.engine.ts) and the quote
// lists every night, so an unbounded range (say, to 9999-12-31: ~2.9 million nights) would keep the
// server busy and fill its memory on a single request. Real stays are far shorter and booked well
// within two years.
export const MAX_NIGHTS = 60;
export const MAX_DAYS_AHEAD = 730;

const DAY_MS = 86_400_000;
// Days since the epoch of a YYYY-MM-DD date; NaN for an impossible one ("2026-13-45").
const dayNumber = (s: string): number => Date.parse(`${s}T00:00:00Z`) / DAY_MS;

function checkPublicStay(d: { checkIn: string; checkOut: string }, ctx: z.RefinementCtx) {
  const checkIn = dayNumber(d.checkIn);
  const nights = dayNumber(d.checkOut) - checkIn;
  if (!(nights > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Check-out must be after check-in', path: ['checkOut'] });
    return;
  }
  if (nights > MAX_NIGHTS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `A stay can be at most ${MAX_NIGHTS} nights`,
      path: ['checkOut'],
    });
  }
  if (checkIn > Math.floor(Date.now() / DAY_MS) + MAX_DAYS_AHEAD) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Check-in can be at most ${MAX_DAYS_AHEAD} days ahead`,
      path: ['checkIn'],
    });
  }
}

// Add-ons picked on the public form. Bounded so a request can't ask for millions of items (a
// nonsense price) or send thousands of ids to look up.
export const MAX_ADDONS = 20;
export const MAX_ADDON_QUANTITY = 20;
const addonsInput = z
  .array(
    z.object({
      addonId: z.string().max(64),
      quantity: z.coerce.number().int().min(1).max(MAX_ADDON_QUANTITY).default(1),
    }),
  )
  .max(MAX_ADDONS)
  .default([]);

// Guest fields shared by the public request form and admin manual bookings.
const guestName = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/\p{L}/u, 'Name must contain letters');
// Stored normalized ("+380501112233"); see lib/phone.ts.
const guestPhone = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid phone number' });
      return z.NEVER;
    }
    return phone;
  });
// Optional: '' (an untouched field) is treated as "not given".
const guestEmail = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().trim().email().max(200).optional(),
);
// The form offers 1–6 (or up to capacity); above the capacity is flagged, not rejected.
const guestsCount = z.coerce.number().int().min(1).max(50).default(2);

export const createBookingSchema = z
  .object({
    guestName,
    guestPhone,
    guestEmail,
    guestsCount,
    checkIn: dateStr,
    checkOut: dateStr,
    comments: z.string().trim().max(2000).optional(),
    promotionSlug: z.string().max(120).optional(),
    addons: addonsInput,
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
    // honeypot — must be empty
    website: z.string().max(0).optional(),
  })
  .superRefine(checkPublicStay);

export const quoteSchema = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
    promotionSlug: z.string().max(120).optional(),
    addons: addonsInput,
  })
  .superRefine(checkPublicStay);

export const availabilityQuerySchema = z.object({ from: dateStr, to: dateStr });

export const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'DECLINED', 'CANCELLED']),
  internalNotes: z.string().max(2000).optional(),
});

// Admin "new booking" (phone/walk-in guests). Confirmed by default — the owner has already
// agreed with the guest. priceMinor overrides the rules-based quote (phone discounts, etc.).
export const adminCreateBookingSchema = z
  .object({
    guestName,
    guestPhone,
    guestEmail,
    guestsCount,
    checkIn: dateStr,
    checkOut: dateStr,
    status: z.enum(['CONFIRMED', 'PENDING']).default('CONFIRMED'),
    priceMinor: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
    internalNotes: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

export const listBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'DECLINED', 'EXPIRED', 'CANCELLED']).optional(),
  period: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const updateNotesSchema = z.object({
  internalNotes: z.string().max(2000).nullable(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type AdminCreateBookingInput = z.infer<typeof adminCreateBookingSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;

import { z } from 'zod';
import { normalizePhone } from '../../lib/phone.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createBookingSchema = z
  .object({
    guestName: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/\p{L}/u, 'Name must contain letters'),
    // Stored normalized ("+380501112233"); see lib/phone.ts.
    guestPhone: z
      .string()
      .max(40)
      .transform((v, ctx) => {
        const phone = normalizePhone(v);
        if (!phone) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid phone number' });
          return z.NEVER;
        }
        return phone;
      }),
    // Optional: '' (an untouched field) is treated as "not given".
    guestEmail: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().trim().email().max(200).optional(),
    ),
    // The form offers 1–6 (or up to capacity); above the capacity is flagged, not rejected.
    guestsCount: z.coerce.number().int().min(1).max(50).default(2),
    checkIn: dateStr,
    checkOut: dateStr,
    comments: z.string().trim().max(2000).optional(),
    promotionSlug: z.string().optional(),
    addons: z
      .array(z.object({ addonId: z.string(), quantity: z.coerce.number().int().min(1).default(1) }))
      .default([]),
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
    // honeypot — must be empty
    website: z.string().max(0).optional(),
  })
  .refine((d) => d.checkOut > d.checkIn, {
    message: 'Check-out must be after check-in',
    path: ['checkOut'],
  });

export const quoteSchema = z
  .object({
    checkIn: dateStr,
    checkOut: dateStr,
    promotionSlug: z.string().optional(),
    addons: z
      .array(z.object({ addonId: z.string(), quantity: z.coerce.number().int().min(1).default(1) }))
      .default([]),
  })
  .refine((d) => d.checkOut > d.checkIn, { message: 'Invalid range', path: ['checkOut'] });

export const availabilityQuerySchema = z.object({ from: dateStr, to: dateStr });

export const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'DECLINED', 'CANCELLED']),
  internalNotes: z.string().max(2000).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;

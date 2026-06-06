import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createBookingSchema = z
  .object({
    guestName: z.string().min(2).max(120),
    guestPhone: z.string().min(5).max(40),
    guestEmail: z.string().email().optional(),
    guestsCount: z.coerce.number().int().min(1).max(20).default(2),
    checkIn: dateStr,
    checkOut: dateStr,
    comments: z.string().max(2000).optional(),
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

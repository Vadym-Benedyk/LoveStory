// Public stay limits (booking.schema.ts): an unbounded date range used to make one /quote request
// price millions of nights and block the server.
import { describe, expect, it } from 'vitest';
import {
  MAX_ADDONS,
  MAX_ADDON_QUANTITY,
  MAX_DAYS_AHEAD,
  MAX_NIGHTS,
  createBookingSchema,
  quoteSchema,
} from '../src/modules/booking/booking.schema.js';
import { bookingRequest, day } from './helpers.js';

const quote = (checkIn: string, checkOut: string) => quoteSchema.safeParse({ checkIn, checkOut });

describe('public stay limits', () => {
  it('accepts a normal stay and the longest allowed one', () => {
    expect(quote(day(10), day(12)).success).toBe(true);
    expect(quote(day(10), day(10 + MAX_NIGHTS)).success).toBe(true);
    expect(quote(day(MAX_DAYS_AHEAD), day(MAX_DAYS_AHEAD + 2)).success).toBe(true);
  });

  it.each([
    ['check-out not after check-in', day(10), day(10)],
    ['one night over the limit', day(10), day(11 + MAX_NIGHTS)],
    ['a range to the year 9999', day(10), '9999-12-31'],
    ['a check-in too far ahead', day(MAX_DAYS_AHEAD + 1), day(MAX_DAYS_AHEAD + 3)],
    ['an impossible date', '2026-13-45', '2026-13-47'],
  ])('rejects %s', (_label, checkIn, checkOut) => {
    expect(quote(checkIn, checkOut).success).toBe(false);
    expect(createBookingSchema.safeParse(bookingRequest(checkIn, checkOut)).success).toBe(false);
  });
});

describe('add-on limits', () => {
  const withAddons = (addons: unknown) => quoteSchema.safeParse({ checkIn: day(10), checkOut: day(12), addons });
  const many = (n: number, quantity = 1) => Array.from({ length: n }, (_, i) => ({ addonId: `a${i}`, quantity }));

  it('accepts up to the limits', () => {
    expect(withAddons(many(MAX_ADDONS, MAX_ADDON_QUANTITY)).success).toBe(true);
  });

  it('rejects too many add-ons or an absurd quantity', () => {
    expect(withAddons(many(MAX_ADDONS + 1)).success).toBe(false);
    expect(withAddons(many(1, MAX_ADDON_QUANTITY + 1)).success).toBe(false);
    expect(withAddons(many(1, 1_000_000_000)).success).toBe(false);
  });
});

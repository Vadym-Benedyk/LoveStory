import { describe, it, expect } from 'vitest';
import { buildQuote } from '../src/modules/pricing/pricing.engine.js';
import type { PriceRule } from '@prisma/client';

const rule = (over: Partial<PriceRule>): PriceRule => ({
  id: Math.random().toString(36),
  name: 'r',
  nameEn: 'r',
  kind: 'BASE',
  nightlyRateMinor: 10000,
  currency: 'UAH',
  appliesFrom: null,
  appliesTo: null,
  daysOfWeek: '',
  dates: '',
  minNights: null,
  priority: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

describe('pricing engine', () => {
  const rules = [
    rule({ name: 'Base', kind: 'BASE', nightlyRateMinor: 10000, priority: 0 }),
    rule({ name: 'Weekend', kind: 'WEEKEND', nightlyRateMinor: 15000, daysOfWeek: '5,6', priority: 10 }),
  ];

  it('charges base rate on weekdays', () => {
    // Mon 2025-06-02 -> Wed 2025-06-04 = 2 weekday nights
    const q = buildQuote({
      checkIn: new Date('2025-06-02'),
      checkOut: new Date('2025-06-04'),
      rules,
      currency: 'UAH',
    });
    expect(q.nights).toBe(2);
    expect(q.accommodationMinor).toBe(20000);
  });

  it('applies weekend rate on Fri/Sat nights', () => {
    // Fri 2025-06-06 -> Sun 2025-06-08 = Fri + Sat nights = weekend x2
    const q = buildQuote({
      checkIn: new Date('2025-06-06'),
      checkOut: new Date('2025-06-08'),
      rules,
      currency: 'UAH',
    });
    expect(q.accommodationMinor).toBe(30000);
  });

  it('applies a percent promotion to accommodation only', () => {
    const q = buildQuote({
      checkIn: new Date('2025-06-02'),
      checkOut: new Date('2025-06-04'),
      rules,
      currency: 'UAH',
      promotion: {
        id: 'p',
        title: '10 off',
        slug: 'ten',
        body: '',
        imageMediaId: null,
        discountType: 'PERCENT',
        discountValue: 10,
        validFrom: null,
        validTo: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    expect(q.discountMinor).toBe(2000);
    expect(q.totalMinor).toBe(18000);
  });

  describe('specific dates (DATES rule)', () => {
    const withDates = [
      ...rules,
      rule({ name: 'Christmas', kind: 'DATES', dates: '2026-12-25,2026-12-26,2027-04-04', nightlyRateMinor: 30000, priority: 20 }),
    ];
    const night = (checkIn: string, checkOut: string) =>
      buildQuote({ checkIn: new Date(checkIn), checkOut: new Date(checkOut), rules: withDates, currency: 'UAH' }).nightly.map(
        (n) => [n.date, n.rateMinor],
      );

    it('applies only to the listed dates, not to the days between or around them', () => {
      // Wed 23, Thu 24, Fri 25, Sat 26, Sun 27 → 25th and 26th use the DATES rate
      expect(night('2026-12-23', '2026-12-28')).toEqual([
        ['2026-12-23', 10000],
        ['2026-12-24', 10000],
        ['2026-12-25', 30000],
        ['2026-12-26', 30000],
        ['2026-12-27', 10000],
      ]);
    });

    it('beats the weekend rate by priority, and works for a single night and a non-contiguous list', () => {
      expect(night('2027-04-04', '2027-04-05')).toEqual([['2027-04-04', 30000]]); // a Sunday
      expect(night('2026-12-25', '2026-12-26')).toEqual([['2026-12-25', 30000]]); // a Friday: DATES > WEEKEND
    });

    it('is ignored when inactive or when the list is empty', () => {
      const off = [...rules, rule({ kind: 'DATES', dates: '2026-12-25', isActive: false, nightlyRateMinor: 30000, priority: 20 })];
      const empty = [...rules, rule({ kind: 'DATES', dates: '', nightlyRateMinor: 30000, priority: 20 })];
      for (const rs of [off, empty]) {
        const q = buildQuote({ checkIn: new Date('2026-12-25'), checkOut: new Date('2026-12-26'), rules: rs, currency: 'UAH' });
        expect(q.nightly[0]!.rateMinor).toBe(15000); // plain Friday weekend rate
      }
    });
  });
});

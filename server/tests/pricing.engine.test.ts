import { describe, it, expect } from 'vitest';
import { buildQuote } from '../src/modules/pricing/pricing.engine.js';
import type { PriceRule } from '@prisma/client';

const rule = (over: Partial<PriceRule>): PriceRule => ({
  id: Math.random().toString(36),
  name: 'r',
  kind: 'BASE',
  nightlyRateMinor: 10000,
  currency: 'USD',
  appliesFrom: null,
  appliesTo: null,
  daysOfWeek: '',
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
      currency: 'USD',
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
      currency: 'USD',
    });
    expect(q.accommodationMinor).toBe(30000);
  });

  it('applies a percent promotion to accommodation only', () => {
    const q = buildQuote({
      checkIn: new Date('2025-06-02'),
      checkOut: new Date('2025-06-04'),
      rules,
      currency: 'USD',
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
});

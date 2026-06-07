// Pure pricing engine — no DB, fully unit-testable.
// Resolves a nightly rate per night from the active rule set, then layers add-ons & promo.

import type { PriceRule, Addon, Promotion } from '@prisma/client';
import { eachNight, isWeekend, nightsBetween, toDateOnly } from '../../lib/dates.js';

export interface QuoteAddonInput {
  addon: Addon;
  quantity: number;
}

export interface QuoteBreakdownNight {
  date: string;
  rateMinor: number;
  ruleName: string;
}

export interface QuoteResult {
  nights: number;
  nightly: QuoteBreakdownNight[];
  accommodationMinor: number;
  addonsMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: string;
  minNights: number | null;
  meetsMinNights: boolean;
}

// daysOfWeek is stored as a CSV string under SQLite (e.g. "5,6"). Parse to numbers.
function parseDays(csv: string): number[] {
  return csv
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
}

// Pick the highest-priority active rule that applies to a given night.
function resolveNightRule(date: Date, rules: PriceRule[]): PriceRule | undefined {
  const base = rules.find((r) => r.kind === 'BASE' && r.isActive);
  const candidates = rules
    .filter((r) => {
      if (!r.isActive) return false;
      if (r.kind === 'SEASONAL') {
        if (!r.appliesFrom || !r.appliesTo) return false;
        return toDateOnly(date) >= toDateOnly(r.appliesFrom) && toDateOnly(date) < toDateOnly(r.appliesTo);
      }
      if (r.kind === 'WEEKEND') {
        // String() handles the SQLite CSV ("5,6") and is defensive across schema versions.
        const days = parseDays(String(r.daysOfWeek));
        return isWeekend(date, days.length ? days : [5, 6]);
      }
      return false; // BASE handled as fallback
    })
    .sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? base;
}

export function buildQuote(params: {
  checkIn: Date;
  checkOut: Date;
  rules: PriceRule[];
  addons?: QuoteAddonInput[];
  promotion?: Promotion | null;
  currency: string;
}): QuoteResult {
  const { checkIn, checkOut, rules, addons = [], promotion, currency } = params;
  const nights = nightsBetween(checkIn, checkOut);

  const nightly: QuoteBreakdownNight[] = eachNight(checkIn, checkOut).map((d) => {
    const rule = resolveNightRule(d, rules);
    return {
      date: d.toISOString().slice(0, 10),
      rateMinor: rule?.nightlyRateMinor ?? 0,
      ruleName: rule?.name ?? 'No rate',
    };
  });

  const accommodationMinor = nightly.reduce((s, n) => s + n.rateMinor, 0);

  const addonsMinor = addons.reduce((sum, { addon, quantity }) => {
    const q = Math.max(1, quantity);
    switch (addon.unit) {
      case 'PER_NIGHT':
        return sum + addon.priceMinor * nights * q;
      case 'PER_PERSON':
        return sum + addon.priceMinor * q; // q carries person count
      case 'PER_STAY':
      default:
        return sum + addon.priceMinor * q;
    }
  }, 0);

  let discountMinor = 0;
  if (promotion) {
    if (promotion.discountType === 'PERCENT' && promotion.discountValue) {
      discountMinor = Math.round((accommodationMinor * promotion.discountValue) / 100);
    } else if (promotion.discountType === 'FIXED' && promotion.discountValue) {
      discountMinor = Math.min(promotion.discountValue, accommodationMinor);
    }
    // PACKAGE pricing is bespoke; handled by explicit rules elsewhere.
  }

  // Minimum-stay: the strictest minNights among rules that touched this stay.
  const minNights = nightly.reduce<number | null>((min, n) => {
    const rule = rules.find((r) => r.name === n.ruleName);
    if (rule?.minNights == null) return min;
    return min == null ? rule.minNights : Math.max(min, rule.minNights);
  }, null);

  const totalMinor = accommodationMinor + addonsMinor - discountMinor;

  return {
    nights,
    nightly,
    accommodationMinor,
    addonsMinor,
    discountMinor,
    totalMinor,
    currency,
    minNights,
    meetsMinNights: minNights == null || nights >= minNights,
  };
}

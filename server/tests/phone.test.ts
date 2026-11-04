import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/lib/phone.js';

describe('normalizePhone', () => {
  it.each([
    ['+380 (50) 111-22-33', '+380501112233'], // what the site's mask produces
    ['+380501112233', '+380501112233'],
    ['380501112233', '+380501112233'],
    ['050 111 22 33', '+380501112233'], // Ukrainian national format
    ['+48 512 345 678', '+48512345678'], // international (API callers)
    ['+1 (415) 555-2671', '+14155552671'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each([
    ['Cepesh'],
    ['12345'],
    ['+380 (50) 111-22'], // incomplete Ukrainian number
    ['+380 50 111 22 333'], // too long for +380
    ['+1234567890123456'], // > 15 digits
  ])('rejects %s', (input) => expect(normalizePhone(input)).toBeNull());
});

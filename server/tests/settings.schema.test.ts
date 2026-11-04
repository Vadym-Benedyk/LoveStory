import { describe, it, expect } from 'vitest';
import {
  normalizeMapEmbed,
  parseSocialLinks,
  updateSettingsSchema,
} from '../src/modules/settings/settings.schema.js';

const EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2540!2d30.5!3d50.4';

describe('normalizeMapEmbed', () => {
  it('extracts the src from Google’s iframe snippet (and decodes &amp;)', () => {
    const snippet = `<iframe src="${EMBED.replace('?', '?x=1&amp;')}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
    expect(normalizeMapEmbed(snippet)).toBe(EMBED.replace('?', '?x=1&'));
  });

  it('accepts a bare embed URL and empty input', () => {
    expect(normalizeMapEmbed(`  ${EMBED}  `)).toBe(EMBED);
    expect(normalizeMapEmbed('   ')).toBe('');
  });

  it.each([
    ['http (not https)', EMBED.replace('https', 'http')],
    ['non-embed Google Maps link', 'https://www.google.com/maps/place/Kyiv'],
    ['other host', 'https://evil.example/maps/embed?pb=1'],
    ['lookalike host', 'https://www.google.com.evil.example/maps/embed'],
    ['script', '<script>alert(1)</script>'],
    ['javascript: src', '<iframe src="javascript:alert(1)"></iframe>'],
  ])('rejects %s', (_label, input) => expect(normalizeMapEmbed(input)).toBeNull());
});

describe('parseSocialLinks', () => {
  it('keeps known non-empty string keys only, tolerates junk', () => {
    expect(parseSocialLinks('{"instagram":"https://instagram.com/x","tiktok":"","foo":"bar"}')).toEqual({
      instagram: 'https://instagram.com/x',
    });
    expect(parseSocialLinks('not json')).toEqual({});
    expect(parseSocialLinks(null)).toEqual({});
  });
});

describe('updateSettingsSchema', () => {
  it('strips unknown keys so internal columns cannot be written', () => {
    const parsed = updateSettingsSchema.parse({ phone: '+380', id: 'hijack', currency: 'XXX' });
    expect(parsed).toEqual({ phone: '+380' });
  });

  it('normalizes the map snippet and validates emails / links', () => {
    expect(updateSettingsSchema.parse({ mapEmbed: `<iframe src="${EMBED}"></iframe>` }).mapEmbed).toBe(EMBED);
    expect(updateSettingsSchema.safeParse({ mapEmbed: 'https://maps.app.goo.gl/abc' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ notificationEmail: 'nope' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ notificationEmail: '' }).success).toBe(true);
    expect(updateSettingsSchema.safeParse({ socialLinks: { instagram: 'http://x.com' } }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ capacity: 0 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ capacity: 1 }).success).toBe(true);
  });
});

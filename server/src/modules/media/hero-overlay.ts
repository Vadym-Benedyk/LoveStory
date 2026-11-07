import { prisma } from '../../lib/prisma.js';

// How dark the layer over the home-page splash photo is, on a 0–100 slider: 0 = none, 80 = the
// standard look, 100 = the darkest. It keeps the light headline readable on any photo. The client
// turns the number into a gradient (client/src/shared/hero.ts; keep the 80 in sync).
//
// Stored as a ContentBlock under a locale-independent pseudo-locale: no schema change, and it
// never shows up in the per-language site copy (those queries filter by 'uk' / 'en').
export const HERO_OVERLAY_KEY = 'hero.overlay';
export const HERO_OVERLAY_LOCALE = '*';
export const HERO_OVERLAY_DEFAULT = 80;

const where = { key_locale: { key: HERO_OVERLAY_KEY, locale: HERO_OVERLAY_LOCALE } };

export async function readHeroOverlay(): Promise<number> {
  const row = await prisma.contentBlock.findUnique({ where });
  return row && /^\d{1,3}$/.test(row.value) && Number(row.value) <= 100 ? Number(row.value) : HERO_OVERLAY_DEFAULT;
}

export async function writeHeroOverlay(value: number, userId: string): Promise<void> {
  await prisma.contentBlock.upsert({
    where,
    update: { value: String(value), updatedById: userId },
    create: { key: HERO_OVERLAY_KEY, locale: HERO_OVERLAY_LOCALE, value: String(value), updatedById: userId },
  });
}

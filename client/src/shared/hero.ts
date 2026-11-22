// Home-page splash: shared by the public page and the admin preview, so both look the same.

// Shown when no splash photo has been uploaded (admin → Gallery → Home page splash).
export const DEFAULT_HERO_URL =
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=70';

// Screens at least this narrow (phones held upright) get the splash's 9:16 crop instead of the large copy.
// Must match PORTRAIT_ASPECT in server/src/lib/image-variants.ts, and the early preload in index.html.
export const HERO_PORTRAIT_MEDIA = '(max-aspect-ratio: 9/16)';

// The darkening over the photo keeps the light headline readable. `percent` is the admin slider:
// 0 = none, 80 = the standard look (35% at the top → 55% at the bottom), 100 = the darkest (1.25×
// the standard). Out of range is clamped. The server's default (hero-overlay.ts) is the same 80.
export const HERO_OVERLAY_STANDARD = 80;
export const DEFAULT_HERO_OVERLAY = HERO_OVERLAY_STANDARD;

export function heroOverlayGradient(percent: number): string {
  const k = Math.min(Math.max(percent, 0), 100) / HERO_OVERLAY_STANDARD;
  return `linear-gradient(rgba(43, 38, 32, ${(0.35 * k).toFixed(3)}), rgba(43, 38, 32, ${(0.55 * k).toFixed(3)}))`;
}

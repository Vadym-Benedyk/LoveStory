// Optional font / colour overrides for the hero texts, set in admin → Content.
// Only values from these lists (or a #rrggbb colour) are ever applied, so stored content can't inject CSS.
import type { CSSProperties } from 'react';

// All of these have Cyrillic glyphs (Ukrainian text). Cormorant Garamond and Inter are the site's own
// fonts (bundled, main.tsx); the others come from Google Fonts (`google`: the css2 `family` value) and are
// loaded only when a text uses one (loadTextFont), so visitors don't download five fonts for nothing.
export const TEXT_FONTS: { key: string; label: string; css: string; google?: string }[] = [
  { key: 'cormorant', label: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif" },
  { key: 'playfair', label: 'Playfair Display', css: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@500;700' },
  { key: 'lora', label: 'Lora', css: "'Lora', Georgia, serif", google: 'Lora:wght@500;700' },
  { key: 'inter', label: 'Inter', css: "'Inter', system-ui, sans-serif" },
  { key: 'montserrat', label: 'Montserrat', css: "'Montserrat', system-ui, sans-serif", google: 'Montserrat:wght@400;600' },
  { key: 'caveat', label: 'Caveat', css: "'Caveat', cursive", google: 'Caveat:wght@500;700' },
  { key: 'marck', label: 'Marck Script', css: "'Marck Script', cursive", google: 'Marck+Script' },
];

// Adds the Google Fonts stylesheet of each of these fonts once (unknown keys and bundled fonts: nothing).
export function loadTextFonts(keys: (string | undefined)[]) {
  for (const key of keys) {
    const family = TEXT_FONTS.find((f) => f.key === key)?.google;
    if (!family || document.querySelector(`link[data-text-font="${key}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    link.dataset.textFont = key;
    document.head.appendChild(link);
  }
}

// Swatches for text on top of the hero photo.
export const TEXT_COLORS: { value: string; label: string }[] = [
  { value: '#fbf8f1', label: 'Cream' },
  { value: '#ffffff', label: 'White' },
  { value: '#f3d9a4', label: 'Sand' },
  { value: '#c9d8c5', label: 'Sage' },
  { value: '#2b2620', label: 'Dark' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function textStyle(font?: string, color?: string): CSSProperties | undefined {
  const css = TEXT_FONTS.find((f) => f.key === font)?.css;
  const col = color && HEX.test(color) ? color : undefined;
  return css || col ? { ...(css ? { fontFamily: css } : {}), ...(col ? { color: col } : {}) } : undefined;
}

export const isHexColor = (v: string) => HEX.test(v);

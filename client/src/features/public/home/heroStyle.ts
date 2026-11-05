// Optional font / colour overrides for the hero texts, set in admin → Content.
// Only values from these lists (or a #rrggbb colour) are ever applied, so stored content can't inject CSS.
import type { CSSProperties } from 'react';

// All of these have Cyrillic glyphs (Ukrainian text), loaded in index.html / main.tsx.
export const HERO_FONTS: { key: string; label: string; css: string }[] = [
  { key: 'cormorant', label: 'Cormorant Garamond', css: "'Cormorant Garamond', Georgia, serif" },
  { key: 'playfair', label: 'Playfair Display', css: "'Playfair Display', Georgia, serif" },
  { key: 'lora', label: 'Lora', css: "'Lora', Georgia, serif" },
  { key: 'inter', label: 'Inter', css: "'Inter', system-ui, sans-serif" },
  { key: 'montserrat', label: 'Montserrat', css: "'Montserrat', system-ui, sans-serif" },
  { key: 'caveat', label: 'Caveat', css: "'Caveat', cursive" },
  { key: 'marck', label: 'Marck Script', css: "'Marck Script', cursive" },
];

export const HERO_COLORS: { value: string; label: string }[] = [
  { value: '#fbf8f1', label: 'Cream' },
  { value: '#ffffff', label: 'White' },
  { value: '#f3d9a4', label: 'Sand' },
  { value: '#c9d8c5', label: 'Sage' },
  { value: '#2b2620', label: 'Dark' },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function heroTextStyle(font?: string, color?: string): CSSProperties | undefined {
  const css = HERO_FONTS.find((f) => f.key === font)?.css;
  const col = color && HEX.test(color) ? color : undefined;
  return css || col ? { ...(css ? { fontFamily: css } : {}), ...(col ? { color: col } : {}) } : undefined;
}

export const isHexColor = (v: string) => HEX.test(v);

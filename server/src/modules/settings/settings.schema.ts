import { z } from 'zod';

// ---------------------------------------------------------------------------
// Map embed: we store ONLY a Google Maps embed URL and render the <iframe> ourselves.
// Storing raw HTML (and rendering it with innerHTML) would let anything in Settings run as
// script on the public site.
// ---------------------------------------------------------------------------
const MAP_HOSTS = new Set(['www.google.com', 'google.com', 'maps.google.com']);

export function isMapEmbedUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && MAP_HOSTS.has(u.hostname) && u.pathname.startsWith('/maps/embed');
  } catch {
    return false;
  }
}

// Accepts what Google's "Share → Embed a map" gives you (an <iframe ...> snippet) or the bare
// src URL. Returns the embed URL, '' for empty input, or null when it isn't a Google embed.
export function normalizeMapEmbed(input: string): string | null {
  const raw = input.trim();
  if (!raw) return '';
  const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1] ?? raw;
  const url = src.replace(/&amp;/g, '&');
  return isMapEmbedUrl(url) ? url : null;
}

// ---------------------------------------------------------------------------
// Social links: stored as a JSON string column (SQLite has no JSON type in our schema).
// ---------------------------------------------------------------------------
export const SOCIAL_KEYS = ['instagram', 'tiktok'] as const;
export type SocialLinks = Partial<Record<(typeof SOCIAL_KEYS)[number], string>>;

export function parseSocialLinks(json: string | null | undefined): SocialLinks {
  try {
    const obj = JSON.parse(json || '{}') as Record<string, unknown>;
    const out: SocialLinks = {};
    for (const k of SOCIAL_KEYS) {
      if (typeof obj[k] === 'string' && obj[k]) out[k] = obj[k] as string;
    }
    return out;
  } catch {
    return {};
  }
}

const optionalEmail = z.union([z.literal(''), z.string().trim().email().max(200)]);
const optionalHttpsUrl = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .url()
    .max(300)
    .refine((v) => v.startsWith('https://'), 'Must start with https://'),
]);

// Only the fields that actually drive something on the site / in notifications. Unknown keys
// are stripped by zod, so this endpoint can't write arbitrary SiteSettings columns.
export const updateSettingsSchema = z
  .object({
    capacity: z.coerce.number().int().min(1).max(50),
    phone: z.string().trim().max(40),
    email: optionalEmail,
    address: z.string().trim().max(300),
    mapEmbed: z
      .string()
      .max(5000)
      .transform((v, ctx) => {
        const url = normalizeMapEmbed(v);
        if (url === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Expected a Google Maps embed link (Share → Embed a map)',
          });
          return z.NEVER;
        }
        return url;
      }),
    notificationEmail: optionalEmail,
    notifyToSiteEmail: z.boolean(),
    socialLinks: z.object({ instagram: optionalHttpsUrl, tiktok: optionalHttpsUrl }).partial(),
  })
  .partial();

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

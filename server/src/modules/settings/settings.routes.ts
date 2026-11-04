import { Router } from 'express';
import type { SiteSettings } from '@prisma/client';
import { asyncHandler } from '../../lib/async-handler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { isMapEmbedUrl, parseSocialLinks, updateSettingsSchema, type UpdateSettingsInput } from './settings.schema.js';

// Public subset of SiteSettings (GET /content). Never include notificationEmail or other
// internal fields here.
export function toPublicSettings(s: SiteSettings | null) {
  if (!s) return null;
  return {
    propertyName: s.propertyName,
    capacity: s.capacity,
    areaSqm: s.areaSqm,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    address: s.address,
    // Only a validated embed URL ever reaches the page (legacy HTML values are dropped).
    mapEmbedUrl: s.mapEmbed && isMapEmbedUrl(s.mapEmbed) ? s.mapEmbed : null,
    socialLinks: parseSocialLinks(s.socialLinks),
  };
}

function toAdminSettings(s: SiteSettings) {
  return {
    capacity: s.capacity,
    phone: s.phone,
    email: s.email,
    address: s.address,
    mapEmbed: s.mapEmbed ?? '',
    // Lets the admin preview the map only when it is a valid embed (legacy values may not be).
    mapEmbedValid: Boolean(s.mapEmbed && isMapEmbedUrl(s.mapEmbed)),
    notificationEmail: s.notificationEmail,
    socialLinks: parseSocialLinks(s.socialLinks),
  };
}

async function getOrCreateSettings() {
  return prisma.siteSettings.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } });
}

export const adminSettingsRouter = Router();
// Property & notification settings are owner-only (docs/product-design.md role table).
adminSettingsRouter.use(requireAuth, requireRole('OWNER'));

adminSettingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(toAdminSettings(await getOrCreateSettings()));
  }),
);

adminSettingsRouter.put(
  '/',
  validate({ body: updateSettingsSchema }),
  asyncHandler(async (req, res) => {
    const { socialLinks, ...rest } = req.body as UpdateSettingsInput;
    const current = await getOrCreateSettings();

    const data: Record<string, unknown> = { ...rest };
    if (socialLinks) {
      // Merge so a partial update doesn't wipe the other networks; '' removes one.
      const merged = { ...parseSocialLinks(current.socialLinks), ...socialLinks };
      data.socialLinks = JSON.stringify(Object.fromEntries(Object.entries(merged).filter(([, v]) => v)));
    }

    // Nothing recognised in the body (e.g. only unknown keys, which zod strips): no-op.
    if (Object.keys(data).length === 0) return res.json(toAdminSettings(current));

    const updated = await prisma.siteSettings.update({ where: { id: 'default' }, data });
    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: 'SETTINGS_UPDATED',
        entity: 'SiteSettings',
        entityId: 'default',
        meta: JSON.stringify({ fields: Object.keys(data) }),
      },
    });
    res.json(toAdminSettings(updated));
  }),
);

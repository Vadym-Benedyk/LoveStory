import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'owner@example.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? 'ChangeMe123!';
const CURRENCY = process.env.DEFAULT_CURRENCY ?? 'USD';

const defaultContent: Record<string, string> = {
  'hero.headline': 'Your private riverside escape',
  'hero.subheadline': 'A cozy 60 m² retreat on a quiet river — fishing, fire-cooking, and a heated tub under the open sky.',
  'about.title': 'A house by the water, all to yourself',
  'about.body':
    'Tucked away on an isolated stretch of riverbank, this 60 m² guest house is built for slowing down. Total privacy, the sound of the water, and nothing on the schedule but rest.',
  'contact.note': 'Bookings are confirmed personally by phone. Reach out any time.',
};

async function main() {
  // Owner
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: { email: OWNER_EMAIL, passwordHash, name: 'Owner', role: 'OWNER' },
  });

  // Settings singleton
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      propertyName: 'LoveStory Riverside Retreat',
      capacity: 4,
      areaSqm: 60,
      currency: CURRENCY,
      notificationEmail: OWNER_EMAIL,
      email: OWNER_EMAIL,
    },
  });

  // Content blocks
  for (const [key, value] of Object.entries(defaultContent)) {
    await prisma.contentBlock.upsert({
      where: { key_locale: { key, locale: 'en' } },
      update: {},
      create: { key, locale: 'en', value },
    });
  }

  // Base + weekend price rules
  const base = await prisma.priceRule.findFirst({ where: { kind: 'BASE' } });
  if (!base) {
    await prisma.priceRule.createMany({
      data: [
        { name: 'Standard nightly', kind: 'BASE', nightlyRateMinor: 12000, currency: CURRENCY, priority: 0 },
        {
          name: 'Weekend',
          kind: 'WEEKEND',
          nightlyRateMinor: 15000,
          currency: CURRENCY,
          daysOfWeek: [5, 6],
          priority: 10,
        },
      ],
    });
  }

  // Add-ons
  const addonCount = await prisma.addon.count();
  if (addonCount === 0) {
    await prisma.addon.createMany({
      data: [
        { name: 'Firewood bundle', priceMinor: 1500, unit: 'PER_STAY', sortOrder: 1, currency: CURRENCY },
        { name: 'Heated tub session', priceMinor: 2500, unit: 'PER_NIGHT', sortOrder: 2, currency: CURRENCY },
        { name: 'Welcome basket', priceMinor: 3000, unit: 'PER_STAY', sortOrder: 3, currency: CURRENCY },
      ],
    });
  }

  // Sample approved review
  const reviewCount = await prisma.review.count();
  if (reviewCount === 0) {
    await prisma.review.create({
      data: {
        authorName: 'Anna & Mark',
        rating: 5,
        title: 'Pure calm',
        body: 'We fished at dawn, grilled at dusk, and soaked in the tub under the stars. Already planning our return.',
        stayMonth: 'August 2025',
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Owner login:', OWNER_EMAIL);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

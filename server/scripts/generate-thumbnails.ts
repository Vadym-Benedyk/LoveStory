/* eslint-disable no-console */
/**
 * Make the lighter copies (thumbnail + 2400 px "large" version) for photos uploaded before they existed.
 * New uploads get them automatically. Safe to run any time and more than once: a photo that already
 * has everything it needs is left alone. Originals are never changed or deleted.
 *
 * Usage:
 *   npm run media:thumbnails            # only what is missing
 *   npm run media:thumbnails -- --all   # redo every photo (e.g. after changing the sizes)
 *
 * Works with whichever storage STORAGE_DRIVER selects (local disk or S3): each original is read from
 * there and the copies are written next to it. A photo's `url` (what the viewer and the splash show)
 * is switched to its large copy; the thumbnail goes in `thumbnailUrl`.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { makeVariants } from '../src/lib/image-variants.js';
import {
  isStorageConfigured,
  largeKeyFor,
  publicUrlFor,
  putObject,
  readObject,
  thumbnailKeyFor,
} from '../src/lib/storage.js';

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

async function main() {
  if (!isStorageConfigured()) {
    console.error('Storage is not configured (see STORAGE_DRIVER / S3_* in server/.env).');
    process.exit(1);
  }
  const all = process.argv.includes('--all');
  const photos = await prisma.media.findMany({ where: { type: 'IMAGE' }, orderBy: { createdAt: 'asc' } });

  let updated = 0;
  let optimal = 0;
  let failed = 0;
  for (const photo of photos) {
    const needsThumbnail = all || !photo.thumbnailUrl;
    // `url` ends with -large.webp once the photo's large copy is in use.
    const needsLarge = all || !photo.url.endsWith('-large.webp');
    if (!needsThumbnail && !needsLarge) {
      optimal++;
      continue;
    }
    try {
      const original = await readObject(photo.storageKey);
      const { thumbnail, large } = await makeVariants(original);
      const data: { thumbnailUrl?: string; url?: string } = {};
      const done: string[] = [];

      if (needsThumbnail) {
        const key = thumbnailKeyFor(photo.storageKey);
        await putObject(key, thumbnail.data, 'image/webp');
        data.thumbnailUrl = publicUrlFor(key);
        done.push(`thumbnail ${kb(thumbnail.data.length)}`);
      }
      if (needsLarge && large) {
        const key = largeKeyFor(photo.storageKey);
        await putObject(key, large.data, 'image/webp');
        data.url = publicUrlFor(key);
        done.push(`large ${kb(large.data.length)} (original ${kb(original.length)})`);
      }

      if (Object.keys(data).length === 0) {
        optimal++; // small and light enough: its original is already what the viewer should show
        continue;
      }
      await prisma.media.update({ where: { id: photo.id }, data });
      updated++;
      console.log(`✓ ${photo.storageKey} → ${done.join(', ')}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${photo.storageKey}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\nPhotos updated: ${updated}, already fine: ${optimal}${failed ? `, failed: ${failed}` : ''}.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

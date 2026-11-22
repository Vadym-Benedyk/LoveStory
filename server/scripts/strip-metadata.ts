/* eslint-disable no-console */
/**
 * Remove the EXIF/XMP/IPTC metadata (GPS location, device, time) from originals uploaded before
 * uploads started doing it themselves. Safe to run any time and more than once: an original with
 * nothing to remove is left alone. Each cleaned file replaces the old one under the same key, so
 * the photo's links don't change; a browser that already cached the old file keeps it until it expires.
 *
 * Usage:
 *   npm run media:strip-metadata
 *
 * Works with whichever storage STORAGE_DRIVER selects (local disk or S3).
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { sniffImage } from '../src/lib/image-type.js';
import { stripMetadata } from '../src/lib/strip-metadata.js';
import { isStorageConfigured, putObject, readObject } from '../src/lib/storage.js';

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

async function main() {
  if (!isStorageConfigured()) {
    console.error('Storage is not configured (see STORAGE_DRIVER / S3_* in server/.env).');
    process.exit(1);
  }
  const photos = await prisma.media.findMany({ where: { type: 'IMAGE' }, orderBy: { createdAt: 'asc' } });

  let cleaned = 0;
  let clean = 0;
  let failed = 0;
  for (const photo of photos) {
    try {
      const original = await readObject(photo.storageKey);
      const kind = sniffImage(original);
      if (!kind) throw new Error('not a supported image');
      const stripped = await stripMetadata(original, kind.ext);
      if (stripped === original) {
        clean++;
        continue;
      }
      await putObject(photo.storageKey, stripped, kind.mime);
      cleaned++;
      console.log(`✓ ${photo.storageKey}: ${kb(original.length)} → ${kb(stripped.length)}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${photo.storageKey}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\nOriginals cleaned: ${cleaned}, already clean: ${clean}${failed ? `, failed: ${failed}` : ''}.`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

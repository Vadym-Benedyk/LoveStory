import sharp from 'sharp';

// Lighter copies of an uploaded photo, made once at upload time so visitors never have to download a
// multi-megabyte original:
//   thumbnail  800 px  the grids (home page, "All photos", the viewer's thumbnail strip, the admin)
//   large      2400 px the full-screen viewer and the home-page splash (it becomes the photo's `url`)
// The original is kept as uploaded (Media.storageKey), e.g. to remake the copies later.

export const THUMBNAIL_MAX_SIZE = 800; // longest side, px: crisp at 2× density in a 3-column grid
export const LARGE_MAX_SIZE = 2400; // longest side, px: sharp full-screen on a laptop, zoomable
const THUMBNAIL_QUALITY = 78;
const LARGE_QUALITY = 80;
// A photo this big gets a large copy even if its pixel size is already small (e.g. an uncompressed export).
const LARGE_MIN_BYTES = 1024 * 1024;
// Refuse to decode absurdly large images (decompression bombs): 100 megapixels, far above any phone camera.
const MAX_INPUT_PIXELS = 100_000_000;

export interface ImageVariant {
  data: Buffer; // WebP
  width: number;
  height: number;
}

export interface ImageVariants {
  thumbnail: ImageVariant;
  // null when the original is already small and light enough: the original itself is then what the viewer shows.
  large: ImageVariant | null;
}

// Every copy applies the EXIF orientation (autoOrient) and, like any sharp output, carries no
// metadata, so there is no GPS location in them.
const open = (input: Buffer) => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, autoOrient: true });

async function encode(image: ReturnType<typeof open>, size: number, quality: number): Promise<ImageVariant> {
  const { data, info } = await image
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Throws when the bytes are not a decodable image. That doubles as a real validity check: the
// magic-byte sniffing (image-type.ts) only reads the first few bytes, so a truncated or corrupt
// file would otherwise get through.
export async function makeVariants(input: Buffer): Promise<ImageVariants> {
  const thumbnail = await encode(open(input), THUMBNAIL_MAX_SIZE, THUMBNAIL_QUALITY);

  // Size as it is displayed, i.e. with the EXIF rotation applied.
  const meta = await open(input).metadata();
  const shown = meta.autoOrient ?? meta;
  const longest = Math.max(shown.width ?? 0, shown.height ?? 0);

  let large: ImageVariant | null = null;
  if (longest > LARGE_MAX_SIZE || input.length > LARGE_MIN_BYTES) {
    const candidate = await encode(open(input), LARGE_MAX_SIZE, LARGE_QUALITY);
    // Only worth keeping when it really is lighter (a small PNG graphic may already beat lossy WebP).
    if (candidate.data.length < input.length) large = candidate;
  }
  return { thumbnail, large };
}

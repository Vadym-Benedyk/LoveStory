import sharp from 'sharp';

// Removes what a camera or phone writes into a photo besides the picture: EXIF (GPS location, time,
// device, sometimes the owner's name), XMP, IPTC and text comments. Used on the original before it is
// stored, because its address is public (Media.storageKey is in the gallery API, and a small photo's
// original is its `url`).
//
//   JPEG    rewritten without touching the image data, so the quality stays exactly as uploaded. The
//           only EXIF tag kept is the orientation (rewritten as a tiny EXIF block of its own), so a
//           phone photo is still shown the right way up. The colour profile (ICC) is kept.
//   others  PNG / WebP / AVIF re-encoded with sharp, and only when they carry any metadata (a WebP
//           made in the browser from a HEIC, for one, has none and is stored as is). PNG stays
//           lossless; WebP and AVIF are re-encoded at a high quality.
//
// Returns the input itself when there is nothing to remove, so running it twice changes nothing.

const MAX_INPUT_PIXELS = 100_000_000; // same limit as image-variants.ts

export async function stripMetadata(input: Buffer, ext: string): Promise<Buffer> {
  const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();

  if (ext === 'jpg') {
    const stripped = stripJpeg(input, meta.orientation);
    if (stripped) return stripped.equals(input) ? input : stripped;
    // Not a layout this walker understands (it already decoded fine, so it is unusual, not broken).
  } else if (!meta.exif && !meta.xmp && !meta.iptc && !meta.comments?.length) {
    return input;
  }

  // Re-encode: the EXIF orientation is applied to the pixels (as it is then gone), the colour profile is kept.
  const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, autoOrient: true }).keepIccProfile();
  switch (ext) {
    case 'jpg':
      return image.jpeg({ quality: 92 }).toBuffer();
    case 'png':
      return image.png().toBuffer();
    case 'webp':
      return image.webp({ quality: 90 }).toBuffer();
    case 'avif':
      return image.avif({ quality: 75 }).toBuffer();
    default:
      throw new Error(`stripMetadata: unsupported format "${ext}"`);
  }
}

// --- JPEG -----------------------------------------------------------------------------------------
// A JPEG is a list of segments (0xFF, marker, 2-byte length, payload) up to the scan, whose
// entropy-coded data ends at the next marker that is not 0xFF00 (a stuffed byte) or RSTn. Progressive
// JPEGs have several scans with tables in between. Everything after EOI (e.g. the gain map or depth
// map a phone appends) is dropped.

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const APP0 = 0xe0;
const APP2 = 0xe2;
const APP14 = 0xee; // Adobe: tells the decoder how the colours are encoded, so it must stay
const COM = 0xfe;

const isRst = (m: number) => m >= 0xd0 && m <= 0xd7;
const startsWith = (buf: Buffer, at: number, text: string) => buf.toString('latin1', at, at + text.length) === text;

// null → an unexpected layout; the caller falls back to re-encoding.
function stripJpeg(input: Buffer, orientation: number | undefined): Buffer | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) return null;
  const out: Buffer[] = [input.subarray(0, 2)];
  let pos = 2;

  while (pos < input.length) {
    if (input[pos] !== 0xff) return null;
    // Any number of 0xFF fill bytes may come before a marker.
    while (input[pos] === 0xff && pos < input.length) pos++;
    if (pos >= input.length) return null;
    const marker = input[pos]!;
    const start = pos - 1;
    pos++;

    if (marker === EOI) {
      out.push(Buffer.from([0xff, EOI]));
      if (orientation && orientation >= 2 && orientation <= 8) {
        // Right after JFIF if there is one (it has to come first), else right after SOI.
        out.splice(out[1]?.[1] === APP0 ? 2 : 1, 0, exifOrientation(orientation));
      }
      return Buffer.concat(out);
    }
    if (isRst(marker) || marker === 0x01) return null; // standalone markers outside a scan: not expected here
    if (pos + 2 > input.length) return null;
    const end = pos + input.readUInt16BE(pos);
    if (end > input.length || end < pos + 2) return null;

    // EXIF/XMP (APP1), IPTC (APP13), any other application block and comments go; the colour profile
    // (APP2 "ICC_PROFILE"), JFIF (APP0) and Adobe (APP14) stay, as does everything that is not metadata.
    const isApp = marker >= APP0 && marker <= 0xef;
    const keep =
      (!isApp && marker !== COM) ||
      marker === APP0 ||
      marker === APP14 ||
      (marker === APP2 && startsWith(input, pos + 2, 'ICC_PROFILE\0'));
    if (keep) out.push(input.subarray(start, end));
    pos = end;

    if (marker === SOS) {
      // Copy the entropy-coded data up to the next real marker.
      const dataStart = pos;
      while (pos + 1 < input.length) {
        if (input[pos] === 0xff && input[pos + 1] !== 0 && input[pos + 1] !== 0xff && !isRst(input[pos + 1]!)) break;
        pos++;
      }
      if (pos + 1 >= input.length) return null; // no EOI
      out.push(input.subarray(dataStart, pos));
    }
  }
  return null;
}

// The smallest EXIF block that says how to rotate the picture: one IFD with one tag (0x0112).
function exifOrientation(orientation: number): Buffer {
  const b = Buffer.alloc(36);
  b.writeUInt16BE(0xffe1, 0); // APP1
  b.writeUInt16BE(34, 2); // length: itself + 32 bytes below
  b.write('Exif\0\0', 4, 'latin1');
  b.write('MM', 10, 'latin1'); // big-endian TIFF
  b.writeUInt16BE(42, 12);
  b.writeUInt32BE(8, 14); // IFD0 right after the 8-byte TIFF header
  b.writeUInt16BE(1, 18); // one entry
  b.writeUInt16BE(0x0112, 20); // Orientation
  b.writeUInt16BE(3, 22); // SHORT
  b.writeUInt32BE(1, 24); // one value
  b.writeUInt16BE(orientation, 28); // value (left-aligned in the 4-byte field)
  b.writeUInt32BE(0, 32); // no next IFD
  return b;
}

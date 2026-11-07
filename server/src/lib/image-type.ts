// Identify an image by its leading bytes. Never trust the client's file name or Content-Type:
// uploads are served from our own origin, so what we store (and the extension we give it) must
// be decided from the actual content. Only formats every current browser can display are
// accepted — in particular no SVG (can carry scripts). HEIC is not stored either: the admin UI
// converts it to WebP/JPEG in the browser before uploading (decoding it here would block the
// event loop and need hundreds of MB for a 24 MP photo).
export interface ImageKind {
  ext: string;
  mime: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // ISO-BMFF: bytes 4..8 = "ftyp", bytes 8..12 = major brand.
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis') return { ext: 'avif', mime: 'image/avif' };
  }
  return null;
}

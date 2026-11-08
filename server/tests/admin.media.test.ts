// Gallery / hero photo uploads with the local storage driver: the file is checked by its bytes,
// stored under UPLOADS_DIR, served at /uploads, and shows up on the public /gallery.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sniffImage } from '../src/lib/image-type.js';
import { allKeysFor, largeKeyFor, thumbnailKeyFor, UPLOADS_DIR } from '../src/lib/storage.js';
import { MAX_UPLOAD_BYTES } from '../src/modules/media/media.routes.js';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let owner: string;
let editor: string;
let manager: string;

// A real 1×1 PNG, plus header-only stand-ins for the other formats: enough for sniffImage, but NOT for
// an upload, which also has to decode (so the thumbnail can be made). Real JPEG / WebP / AVIF
// fixtures for uploads are generated with sharp in beforeAll.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const FAKE_WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const FAKE_AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif'), Buffer.alloc(8)]);

let JPEG: Buffer;
let WEBP: Buffer;
let AVIF: Buffer;

// A flat-colour picture of the given size (cheap), or one full of noise (like a real photo: big file).
const blank = (width: number, height: number, noisy = false) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 60, g: 120, b: 90 },
      ...(noisy ? { noise: { type: 'gaussian' as const, mean: 128, sigma: 40 } } : {}),
    },
  });

const origin = () => srv.url.replace(/\/api$/, '');

function upload(
  token: string | undefined,
  body: Buffer,
  { type = 'image/png', query = {} }: { type?: string; query?: Record<string, string> } = {},
) {
  return fetch(`${srv.url}/admin/media/upload?${new URLSearchParams(query)}`, {
    method: 'POST',
    headers: { 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: new Uint8Array(body),
  });
}

const uploadOk = async (body: Buffer, query: Record<string, string> = {}, type = 'image/png') => {
  const res = await upload(owner, body, { type, query });
  expect(res.status).toBe(201);
  return (await res.json()) as {
    id: string;
    storageKey: string;
    url: string;
    thumbnailUrl: string;
    sortOrder: number;
    isHero: boolean;
  };
};

// The splash darkening slider: 80 is the standard look and the default, 100 the darkest.
const STANDARD_OVERLAY = 80;

const exists = (key: string) =>
  fs.access(path.join(UPLOADS_DIR, key)).then(
    () => true,
    () => false,
  );

beforeAll(async () => {
  srv = await startServer();
  JPEG = await blank(64, 48).jpeg().toBuffer();
  WEBP = await blank(64, 48).webp().toBuffer();
  AVIF = await blank(64, 48).avif().toBuffer();
});
afterAll(async () => {
  await srv.close();
  await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
});
beforeEach(async () => {
  await resetDb();
  await fs.rm(UPLOADS_DIR, { recursive: true, force: true });
  owner = (await createUser('OWNER')).token;
  editor = (await createUser('EDITOR')).token;
  manager = (await createUser('MANAGER')).token;
});

describe('sniffImage', () => {
  it('recognises the supported formats by their bytes', () => {
    expect(sniffImage(PNG)).toEqual({ ext: 'png', mime: 'image/png' });
    expect(sniffImage(FAKE_JPEG)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffImage(FAKE_WEBP)).toEqual({ ext: 'webp', mime: 'image/webp' });
    expect(sniffImage(FAKE_AVIF)).toEqual({ ext: 'avif', mime: 'image/avif' });
  });

  it('rejects everything else, including SVG and HTML', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
  });
});

describe('POST /admin/media/upload', () => {
  it('needs an OWNER or EDITOR token', async () => {
    expect((await upload(undefined, PNG)).status).toBe(401);
    expect((await upload(manager, PNG)).status).toBe(403);
    expect((await upload(editor, PNG)).status).toBe(201);
    expect(await prisma.media.count()).toBe(1);
  });

  it('stores the file, serves it at /uploads and lists it on the public gallery', async () => {
    const m = await uploadOk(PNG, { category: 'HOUSE', filename: 'Living room.JPG', width: '1', height: '1' });

    expect(m.storageKey).toMatch(/^gallery\/house\/[0-9a-f-]{36}\.png$/); // extension from the bytes, not the name
    expect(m.url).toBe(`/uploads/${m.storageKey}`);
    expect(await fs.readFile(path.join(UPLOADS_DIR, m.storageKey))).toEqual(PNG);
    expect(m).toMatchObject({ category: 'HOUSE', altText: 'Living room', width: 1, height: 1, isActive: true, isHero: false });

    const file = await fetch(origin() + m.url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(file.headers.get('cache-control')).toContain('immutable');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(PNG);

    const pub = (await call(srv, 'GET', '/gallery')).body;
    expect(pub.photos.map((p: { id: string }) => p.id)).toEqual([m.id]);
    expect(pub.hero).toBeNull();
  });

  it.each([
    ['JPEG', () => JPEG, 'image/jpeg', 'jpg'],
    ['PNG', () => PNG, 'image/png', 'png'],
    ['WebP', () => WEBP, 'image/webp', 'webp'],
    ['AVIF', () => AVIF, 'image/avif', 'avif'],
  ])('accepts %s', async (_name, bytes, type, ext) => {
    const m = await uploadOk(bytes(), {}, type);
    expect(m.storageKey).toMatch(new RegExp(`\\.${ext}$`));
    expect(m.thumbnailUrl).toMatch(/-thumb\.webp$/);
  });

  it('appends new photos at the end of the gallery', async () => {
    const a = await uploadOk(PNG);
    const b = await uploadOk(JPEG, {}, 'image/jpeg');
    expect(b.sortOrder).toBe(a.sortOrder + 1);
    expect([a.isHero, b.isHero]).toEqual([false, false]);
  });

  it('refuses files that are not supported images and stores nothing', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = Buffer.from('<html>not an image</html>');
    const photo = await blank(400, 300, true).jpeg().toBuffer();
    const cases: [Buffer, string][] = [
      [svg, 'image/svg+xml'], // right content type family, wrong bytes
      [html, 'image/png'], // lying content type
      [PNG, 'text/plain'], // real image, but not announced as one
      [Buffer.alloc(0), 'image/png'],
      [FAKE_JPEG, 'image/jpeg'], // starts like a JPEG, but there is no image in it
      [photo.subarray(0, Math.floor(photo.length * 0.4)), 'image/jpeg'], // a real JPEG cut short
    ];
    for (const [body, type] of cases) {
      const res = await upload(owner, body, { type });
      expect(res.status).toBe(415);
      expect((await res.json()).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    }
    expect(await prisma.media.count()).toBe(0);
    expect(await fs.readdir(UPLOADS_DIR).catch(() => [])).toEqual([]);
  });

  it('rejects photos over the size limit with 413', async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff);
    const res = await upload(owner, big, { type: 'image/jpeg' });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe('FILE_TOO_LARGE');
    expect(await prisma.media.count()).toBe(0);
  });

  it('validates the query parameters', async () => {
    expect((await upload(owner, PNG, { query: { category: 'NOPE' } })).status).toBe(400);
    expect((await upload(owner, PNG, { query: { width: '-5' } })).status).toBe(400);
    expect(await prisma.media.count()).toBe(0);
  });
});

describe('thumbnails', () => {
  const thumbOf = async (m: { storageKey: string }) => fs.readFile(path.join(UPLOADS_DIR, thumbnailKeyFor(m.storageKey)));

  it('names a photo\'s thumbnail after it', () => {
    expect(thumbnailKeyFor('gallery/house/abc.jpg')).toBe('gallery/house/abc-thumb.webp');
    expect(thumbnailKeyFor('gallery/other/x.y.webp')).toBe('gallery/other/x.y-thumb.webp');
    expect(thumbnailKeyFor('noext')).toBe('noext-thumb.webp');
    expect(largeKeyFor('gallery/house/abc.jpg')).toBe('gallery/house/abc-large.webp');
    expect(allKeysFor('gallery/house/abc.jpg')).toEqual([
      'gallery/house/abc.jpg',
      'gallery/house/abc-thumb.webp',
      'gallery/house/abc-large.webp',
    ]);
  });

  it('makes a small WebP next to the photo, serves it, and exposes it on the public gallery', async () => {
    const original = await blank(1600, 1200, true).jpeg({ quality: 90 }).toBuffer();
    const m = await uploadOk(original, { category: 'RIVER' }, 'image/jpeg');

    expect(m.thumbnailUrl).toBe(`/uploads/${thumbnailKeyFor(m.storageKey)}`);
    expect(m.thumbnailUrl).toMatch(/^\/uploads\/gallery\/river\/[0-9a-f-]{36}-thumb\.webp$/);

    const bytes = await thumbOf(m);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: 'webp', width: 800, height: 600 }); // fitted inside 800×800
    expect(bytes.length).toBeLessThan(original.length / 4); // the point of it: far lighter than the photo

    const served = await fetch(origin() + m.thumbnailUrl);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(await fs.readFile(path.join(UPLOADS_DIR, m.storageKey))).toEqual(original); // the original is untouched

    const pub = (await call(srv, 'GET', '/gallery')).body;
    expect(pub.photos[0]).toMatchObject({ url: m.url, thumbnailUrl: m.thumbnailUrl });
  });

  it('never enlarges a small picture', async () => {
    const m = await uploadOk(PNG);
    expect(await sharp(await thumbOf(m)).metadata()).toMatchObject({ width: 1, height: 1 });
  });

  it('applies the EXIF orientation and drops the metadata', async () => {
    // 1200×800 pixels flagged "rotate 90°": it is shown as a 800×1200 portrait.
    const rotated = await blank(1200, 800).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(rotated).metadata()).orientation).toBe(6);

    const m = await uploadOk(rotated, {}, 'image/jpeg');
    const meta = await sharp(await thumbOf(m)).metadata();
    expect(meta.height).toBe(800);
    expect(meta.width).toBeLessThan(meta.height!); // portrait, as the photo is meant to be seen
    expect(meta.exif).toBeUndefined(); // no EXIF (so no GPS location) in the thumbnail
  });

  it('is deleted together with the photo, and with a replaced splash', async () => {
    const photo = await uploadOk(JPEG, {}, 'image/jpeg');
    const first = await uploadOk(JPEG, { isHero: 'true' }, 'image/jpeg');
    const second = await uploadOk(WEBP, { isHero: 'true' }, 'image/webp');

    // replacing the splash removed the old splash's photo and thumbnail
    expect(await exists(first.storageKey)).toBe(false);
    expect(await exists(thumbnailKeyFor(first.storageKey))).toBe(false);
    expect(await exists(second.storageKey)).toBe(true);
    expect(await exists(thumbnailKeyFor(second.storageKey))).toBe(true);

    expect((await call(srv, 'DELETE', `/admin/media/${photo.id}`, { token: owner })).status).toBe(200);
    expect(await exists(photo.storageKey)).toBe(false);
    expect(await exists(thumbnailKeyFor(photo.storageKey))).toBe(false);
  });

  it('a photo from before thumbnails existed still deletes cleanly', async () => {
    const photo = await uploadOk(JPEG, {}, 'image/jpeg');
    await fs.rm(path.join(UPLOADS_DIR, thumbnailKeyFor(photo.storageKey))); // as if it never had one
    await prisma.media.update({ where: { id: photo.id }, data: { thumbnailUrl: null } });
    expect((await call(srv, 'DELETE', `/admin/media/${photo.id}`, { token: owner })).status).toBe(200);
    expect(await exists(photo.storageKey)).toBe(false);
  });
});

describe('large copy (the image of the full-screen viewer and the splash)', () => {
  let BIG: Buffer; // 2600×1950: wider than the 2400 px limit
  beforeAll(async () => {
    BIG = await blank(2600, 1950, true).jpeg({ quality: 90 }).toBuffer();
  });
  const fileOf = (key: string) => fs.readFile(path.join(UPLOADS_DIR, key));

  it('a photo over 2400 px gets a 2400 px WebP, which becomes its url; the original is kept', async () => {
    const m = await uploadOk(BIG, { category: 'HOUSE' }, 'image/jpeg');

    expect(m.storageKey).toMatch(/^gallery\/house\/[0-9a-f-]{36}\.jpg$/); // the original
    expect(m.url).toBe(`/uploads/${largeKeyFor(m.storageKey)}`);
    expect(m.url).toMatch(/-large\.webp$/);

    const large = await fileOf(largeKeyFor(m.storageKey));
    expect(await sharp(large).metadata()).toMatchObject({ format: 'webp', width: 2400, height: 1800 });
    expect(large.length).toBeLessThan(BIG.length);
    expect(await fileOf(m.storageKey)).toEqual(BIG); // the original is untouched

    const served = await fetch(origin() + m.url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');

    const pub = (await call(srv, 'GET', '/gallery')).body;
    expect(pub.photos[0]).toMatchObject({ url: m.url, thumbnailUrl: m.thumbnailUrl });
  });

  it('a small, light photo gets no large copy: its url is the original', async () => {
    const m = await uploadOk(JPEG, {}, 'image/jpeg');
    expect(m.url).toBe(`/uploads/${m.storageKey}`);
    expect(await exists(largeKeyFor(m.storageKey))).toBe(false);
  });

  it('a photo that is small in pixels but over 1 MB still gets a lighter copy, at its own size', async () => {
    const heavy = await blank(1500, 1000, true).jpeg({ quality: 100 }).toBuffer();
    expect(heavy.length).toBeGreaterThan(1024 * 1024); // the fixture really is heavy

    const m = await uploadOk(heavy, {}, 'image/jpeg');
    expect(m.url).toMatch(/-large\.webp$/);
    const large = await fileOf(largeKeyFor(m.storageKey));
    expect(await sharp(large).metadata()).toMatchObject({ width: 1500, height: 1000 }); // not enlarged, not shrunk
    expect(large.length).toBeLessThan(heavy.length);
  });

  it('applies the EXIF orientation to the large copy too', async () => {
    // 2600×1700 pixels flagged "rotate 90°": shown as a 1700×2600 portrait → 1569×2400.
    const rotated = await blank(2600, 1700, true).jpeg({ quality: 85 }).withMetadata({ orientation: 6 }).toBuffer();
    const m = await uploadOk(rotated, {}, 'image/jpeg');
    const meta = await sharp(await fileOf(largeKeyFor(m.storageKey))).metadata();
    expect(meta.height).toBe(2400);
    expect(meta.width).toBeLessThan(meta.height!);
    expect(meta.exif).toBeUndefined();
  });

  it('the splash gets one too, so the home page background is light', async () => {
    const hero = await uploadOk(BIG, { isHero: 'true' }, 'image/jpeg');
    expect(hero.url).toMatch(/-large\.webp$/);
    expect((await call(srv, 'GET', '/gallery')).body.hero.url).toBe(hero.url);
  });

  it('all three files go when the photo is deleted or the splash is replaced', async () => {
    const photo = await uploadOk(BIG, {}, 'image/jpeg');
    const first = await uploadOk(BIG, { isHero: 'true' }, 'image/jpeg');
    const second = await uploadOk(JPEG, { isHero: 'true' }, 'image/jpeg');

    for (const key of allKeysFor(first.storageKey)) expect(await exists(key)).toBe(false); // old splash
    expect(await exists(second.storageKey)).toBe(true);

    for (const key of allKeysFor(photo.storageKey)) expect(await exists(key)).toBe(true);
    expect((await call(srv, 'DELETE', `/admin/media/${photo.id}`, { token: owner })).status).toBe(200);
    for (const key of allKeysFor(photo.storageKey)) expect(await exists(key)).toBe(false);
  });
});

describe('home page splash (hero) is separate from the gallery', () => {
  const gallery = async () =>
    (await call(srv, 'GET', '/gallery')).body as {
      hero: { id: string; url: string } | null;
      photos: { id: string }[];
      heroOverlay: number;
    };

  it('is a single dedicated slot that never appears among the gallery photos', async () => {
    expect(await gallery()).toEqual({ hero: null, photos: [], heroOverlay: STANDARD_OVERLAY });

    const photo = await uploadOk(PNG, { category: 'HOUSE' });
    const hero = await uploadOk(JPEG, { isHero: 'true' }, 'image/jpeg');
    expect(hero.isHero).toBe(true);

    const pub = await gallery();
    expect(pub.hero).toMatchObject({ id: hero.id, url: hero.url });
    expect(pub.photos.map((p) => p.id)).toEqual([photo.id]); // the splash is not duplicated here
  });

  it('a new splash replaces the old one, which is deleted instead of falling into the gallery', async () => {
    const photo = await uploadOk(PNG);
    const first = await uploadOk(JPEG, { isHero: 'true' }, 'image/jpeg');
    const second = await uploadOk(WEBP, { isHero: 'true' }, 'image/webp');

    const pub = await gallery();
    expect(pub.hero?.id).toBe(second.id);
    expect(pub.photos.map((p) => p.id)).toEqual([photo.id]);
    expect(await prisma.media.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await exists(first.storageKey)).toBe(false);
    expect(await exists(second.storageKey)).toBe(true);
    expect(await prisma.media.count({ where: { isHero: true } })).toBe(1);
  });

  it('removing the splash falls back to the default; a gallery photo cannot be turned into the splash', async () => {
    const photo = await uploadOk(PNG);
    const hero = await uploadOk(JPEG, { isHero: 'true' }, 'image/jpeg');

    const patched = await call(srv, 'PATCH', `/admin/media/${photo.id}`, { token: owner, body: { isHero: true } });
    expect(patched.status).toBe(200);
    expect(patched.body.isHero).toBe(false); // ignored: the splash is only set by uploading one
    expect((await gallery()).hero?.id).toBe(hero.id);

    expect((await call(srv, 'DELETE', `/admin/media/${hero.id}`, { token: owner })).status).toBe(200);
    expect(await gallery()).toMatchObject({ hero: null, photos: [{ id: photo.id }] });
  });
});

describe('splash darkening (hero overlay)', () => {
  const put = (token: string | undefined, value: unknown) =>
    call(srv, 'PUT', '/admin/media/hero-overlay', { token, body: { value } });
  const publicOverlay = async () => (await call(srv, 'GET', '/gallery')).body.heroOverlay;

  it('defaults to the standard darkening (80) until it is changed', async () => {
    expect((await call(srv, 'GET', '/admin/media/hero-overlay', { token: owner })).body).toEqual({
      value: STANDARD_OVERLAY,
    });
    expect(await publicOverlay()).toBe(STANDARD_OVERLAY);
  });

  it('is saved once for all languages and served with the gallery', async () => {
    expect((await put(owner, 100)).body).toEqual({ value: 100 }); // the darkest, above the standard
    expect(await publicOverlay()).toBe(100);
    expect((await put(owner, 40)).body).toEqual({ value: 40 });
    expect((await put(editor, 0)).body).toEqual({ value: 0 }); // 0 = no darkening at all
    expect((await call(srv, 'GET', '/admin/media/hero-overlay', { token: owner })).body).toEqual({ value: 0 });
    expect(await publicOverlay()).toBe(0);
    expect(await prisma.contentBlock.count({ where: { key: 'hero.overlay' } })).toBe(1); // updated, not duplicated

    // It is not a piece of per-language site copy.
    for (const locale of ['uk', 'en']) {
      const { copy } = (await call(srv, 'GET', `/content?locale=${locale}`)).body;
      expect(copy).not.toHaveProperty('hero.overlay');
    }
  });

  it('only accepts whole numbers from 0 to 100', async () => {
    for (const bad of [-1, 101, 50.5, '40', null]) {
      expect((await put(owner, bad)).status).toBe(400);
    }
    expect(await publicOverlay()).toBe(STANDARD_OVERLAY);
  });

  it('needs an OWNER or EDITOR token', async () => {
    expect((await put(undefined, 50)).status).toBe(401);
    expect((await put(manager, 50)).status).toBe(403);
    expect((await call(srv, 'GET', '/admin/media/hero-overlay', { token: manager })).status).toBe(403);
    expect(await publicOverlay()).toBe(STANDARD_OVERLAY);
  });
});

describe('editing the gallery', () => {
  it('admin list follows the public order and reordering changes both', async () => {
    const a = await uploadOk(PNG, { category: 'RIVER' });
    const b = await uploadOk(JPEG, { category: 'HOUSE' }, 'image/jpeg');
    const ids = async (path: string, token?: string) =>
      ((await call(srv, 'GET', path, { token })).body as { id: string }[]).map((x) => x.id);
    const publicIds = async () =>
      ((await call(srv, 'GET', '/gallery')).body.photos as { id: string }[]).map((x) => x.id);

    expect(await ids('/admin/media', owner)).toEqual([a.id, b.id]); // not grouped by category
    expect(await publicIds()).toEqual([a.id, b.id]);

    const res = await call(srv, 'POST', '/admin/media/reorder', {
      token: owner,
      body: { items: [{ id: a.id, sortOrder: b.sortOrder }, { id: b.id, sortOrder: a.sortOrder }] },
    });
    expect(res.status).toBe(200);
    expect(await ids('/admin/media', owner)).toEqual([b.id, a.id]);
    expect(await publicIds()).toEqual([b.id, a.id]);
  });

  it('hiding a photo removes it from the public gallery; alt text can be changed', async () => {
    const a = await uploadOk(PNG);
    const patch = (body: unknown) => call(srv, 'PATCH', `/admin/media/${a.id}`, { token: editor, body });

    expect((await patch({ altText: 'Вечір на березі' })).body).toMatchObject({ altText: 'Вечір на березі' });
    expect((await call(srv, 'GET', '/gallery')).body.photos[0]).toMatchObject({ id: a.id, altText: 'Вечір на березі' });

    await patch({ isActive: false });
    expect((await call(srv, 'GET', '/gallery')).body.photos).toEqual([]);
    expect(((await call(srv, 'GET', '/admin/media', { token: owner })).body as unknown[]).length).toBe(1);
  });

  it('deleting removes the row and the file from disk', async () => {
    const a = await uploadOk(PNG);
    expect(await exists(a.storageKey)).toBe(true);

    expect((await call(srv, 'DELETE', `/admin/media/${a.id}`, { token: owner })).status).toBe(200);
    expect(await exists(a.storageKey)).toBe(false);
    expect(await prisma.media.count()).toBe(0);
    expect((await fetch(origin() + a.url)).status).toBe(404);
    expect((await call(srv, 'DELETE', `/admin/media/${a.id}`, { token: owner })).status).toBe(404);
  });
});

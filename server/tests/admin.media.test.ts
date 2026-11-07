// Gallery / hero photo uploads with the local storage driver: the file is checked by its bytes,
// stored under UPLOADS_DIR, served at /uploads, and shows up on the public /gallery.
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sniffImage } from '../src/lib/image-type.js';
import { UPLOADS_DIR } from '../src/lib/storage.js';
import { MAX_UPLOAD_BYTES } from '../src/modules/media/media.routes.js';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let owner: string;
let editor: string;
let manager: string;

// Smallest valid files; only the header matters to the server, but the PNG is a real image.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypavif'), Buffer.alloc(8)]);

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
  return (await res.json()) as { id: string; storageKey: string; url: string; sortOrder: number; isHero: boolean };
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
    expect(sniffImage(JPEG)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(sniffImage(WEBP)).toEqual({ ext: 'webp', mime: 'image/webp' });
    expect(sniffImage(AVIF)).toEqual({ ext: 'avif', mime: 'image/avif' });
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

  it('appends new photos at the end of the gallery', async () => {
    const a = await uploadOk(PNG);
    const b = await uploadOk(JPEG, {}, 'image/jpeg');
    expect(b.sortOrder).toBe(a.sortOrder + 1);
    expect([a.isHero, b.isHero]).toEqual([false, false]);
  });

  it('refuses files that are not supported images and stores nothing', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const html = Buffer.from('<html>not an image</html>');
    const cases: [Buffer, string][] = [
      [svg, 'image/svg+xml'], // right content type family, wrong bytes
      [html, 'image/png'], // lying content type
      [PNG, 'text/plain'], // real image, but not announced as one
      [Buffer.alloc(0), 'image/png'],
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

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

// Photo storage behind one small interface — putObject / deleteObject / publicUrlFor — with two
// drivers chosen by STORAGE_DRIVER:
//   local  files on this server's disk under UPLOADS_DIR, served by app.ts at /uploads.
//   s3     AWS S3 or an S3-compatible service (MinIO/R2: also set S3_ENDPOINT).
// Uploads always pass through the API (media.routes.ts) so the bytes can be validated; the
// browser never talks to storage directly, which also means the bucket needs no CORS rules.
//
// Object keys (`gallery/<category>/<uuid>.<ext>`) are identical for both drivers and stored in
// Media.storageKey. Moving to S3 later = copy the UPLOADS_DIR folder into the bucket as-is and
// switch STORAGE_DRIVER; already-stored Media.url values keep pointing at the local files until
// they are migrated.

// src/lib (dev) or dist/lib (prod) → the server/ folder is two levels up.
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// `||`, not `??`: a blank `UPLOADS_DIR=` in .env must fall back to the default, not resolve to cwd.
export const UPLOADS_DIR = path.resolve(env.UPLOADS_DIR || path.join(serverRoot, 'uploads'));

export const isLocalStorage = env.STORAGE_DRIVER === 'local';

export function isStorageConfigured(): boolean {
  if (isLocalStorage) return true;
  return Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      // Path-style addressing is required by MinIO/most S3-compatible services; real AWS S3
      // works fine with virtual-hosted-style (the SDK default), so only force it for a custom
      // endpoint (i.e. not talking to AWS directly).
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

// Collision-free object key, namespaced by category. `ext` comes from the sniffed image type.
export function buildMediaKey(category: string, ext: string): string {
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'other';
  return `gallery/${safeCategory}/${randomUUID()}.${ext}`;
}

// A photo's thumbnail lives next to it and is named after it: `gallery/house/<id>.jpg` →
// `gallery/house/<id>-thumb.webp`. So it can always be found from the photo's key (to delete it
// together with the photo) and nothing extra needs to be stored.
export const thumbnailKeyFor = (key: string) => `${key.replace(/\.[^./]+$/, '')}-thumb.webp`;
// The large copy (the full-screen viewer's image) sits next to it the same way: `<id>-large.webp`.
export const largeKeyFor = (key: string) => `${key.replace(/\.[^./]+$/, '')}-large.webp`;
// Every file that belongs to a photo, to delete them together (some may not exist: that is harmless).
export const allKeysFor = (key: string) => [key, thumbnailKeyFor(key), largeKeyFor(key)];

// Resolve a key to a file inside UPLOADS_DIR (keys are server-generated; this is defence in depth).
function localPath(key: string): string {
  const full = path.resolve(UPLOADS_DIR, key);
  if (!full.startsWith(UPLOADS_DIR + path.sep)) throw new Error(`Invalid storage key: ${key}`);
  return full;
}

export function publicUrlFor(key: string): string {
  if (isLocalStorage) return `${(env.UPLOADS_PUBLIC_URL || '/uploads').replace(/\/$/, '')}/${key}`;
  if (env.S3_PUBLIC_URL) return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`;
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (isLocalStorage) {
    const file = localPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return;
  }
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Keys are unique per upload and never overwritten, so the file can be cached forever.
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function readObject(key: string): Promise<Buffer> {
  if (isLocalStorage) return fs.readFile(localPath(key));
  const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return Buffer.from(await res.Body!.transformToByteArray());
}

export async function deleteObject(key: string): Promise<void> {
  if (isLocalStorage) {
    await fs.rm(localPath(key), { force: true });
    return;
  }
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

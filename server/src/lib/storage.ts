import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

// Works against real AWS S3 (production) or an S3-compatible service like MinIO/R2 (local
// dev) — set S3_ENDPOINT for the latter. See server/.env.example for the full var list and
// README notes on the bucket CORS policy required for direct browser-to-S3 uploads.
export function isStorageConfigured(): boolean {
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

// Collision-free object key, namespaced by category, keeping the original extension.
export function buildMediaKey(category: string, filename: string): string {
  const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeCategory = category.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'other';
  return `gallery/${safeCategory}/${randomUUID()}${ext ? `.${ext}` : ''}`;
}

export function publicUrlFor(key: string): string {
  if (env.S3_PUBLIC_URL) return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  if (env.S3_ENDPOINT) return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`;
  return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
}

// Presigned PUT URL — the browser uploads the file bytes directly to S3, bypassing our
// server. Requires the bucket to allow PUT (and OPTIONS preflight) from the site origin.
export async function presignUpload(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3(), cmd, { expiresIn: 300 });
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

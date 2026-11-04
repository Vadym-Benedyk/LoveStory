import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  // Number of reverse proxies in front of the app (Railway/Render/Caddy/nginx → usually 1).
  // Needed so rate limits count per visitor, not per proxy IP. Keep 0 when the app is reached
  // directly: trusting X-Forwarded-For without a proxy lets clients spoof their IP.
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  OWNER_EMAIL: z.string().email().default('owner@example.com'),
  OWNER_PASSWORD: z.string().min(6).default('ChangeMe123!'),

  PENDING_EXPIRY_DAYS: z.coerce.number().default(7),
  // All prices are in hryvnias (minor units = kopiyky). Kept configurable, but the site shows UAH.
  DEFAULT_CURRENCY: z.string().default('UAH'),
  TIMEZONE: z.string().default('UTC'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  NOTIFY_EMAIL: z.string().optional(),
  NOTIFY_FROM: z.string().optional(),
  SMTP_URL: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

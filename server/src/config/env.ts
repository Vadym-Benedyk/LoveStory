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

  // Production: at least 32 characters each (openssl rand -hex 32), different, and not an example
  // value from the repository; see the check below the schema.
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  PENDING_EXPIRY_DAYS: z.coerce.number().default(7),
  // All prices are in hryvnias (minor units = kopiyky). Kept configurable, but the site shows UAH.
  DEFAULT_CURRENCY: z.string().default('UAH'),
  TIMEZONE: z.string().default('UTC'),

  // Where uploaded photos are stored. `local` = files on this server's disk, served at /uploads;
  // `s3` = an S3-compatible bucket (needs the S3_* vars below). See src/lib/storage.ts.
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  // Local driver only. Absolute path in production (a persistent volume); default: server/uploads.
  UPLOADS_DIR: z.string().optional(),
  // Local driver only. Public base URL of the uploads when the site and the API are on different
  // origins (e.g. https://api.example.com/uploads). Default: same-origin /uploads.
  UPLOADS_PUBLIC_URL: z.string().optional(),

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

// Whoever knows a token secret can sign themselves an owner's token, so production refuses the weak
// and the published ones (.env.example, the tests) instead of starting with them.
const MIN_PROD_SECRET_LENGTH = 32;
const PUBLIC_EXAMPLE_SECRET = /change-?me|test-(access|refresh)-secret|^(secret|password)$/i;

const checkedSchema = schema.superRefine((e, ctx) => {
  if (e.NODE_ENV !== 'production') return;
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (e[key].length < MIN_PROD_SECRET_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `must be at least ${MIN_PROD_SECRET_LENGTH} characters in production (openssl rand -hex 32)`,
      });
    } else if (PUBLIC_EXAMPLE_SECRET.test(e[key])) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'is an example value; generate a real one' });
    }
  }
  if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_REFRESH_SECRET'],
      message: 'must differ from JWT_ACCESS_SECRET',
    });
  }
});

const parsed = checkedSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

import path from 'node:path';

// Integration tests run against a throwaway SQLite file (never prisma/dev.db).
export const TEST_DB_FILE = path.resolve(__dirname, '../.tmp/test.db');

// Explicit env so tests don't depend on a developer's server/.env (dotenv never overrides
// variables that are already set). Used by vitest.config.ts (workers) and global-setup.ts.
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: `file:${TEST_DB_FILE}`,
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  CLIENT_ORIGIN: 'http://localhost:5173',
  PENDING_EXPIRY_DAYS: '7',
  DEFAULT_CURRENCY: 'UAH',
  SMTP_URL: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  S3_BUCKET: '',
};

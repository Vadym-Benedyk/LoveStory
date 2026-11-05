import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';
import { pinSqliteUrl } from './src/lib/sqlite-path';

// Same pinning as the app (src/lib/prisma.ts): the CLI otherwise resolves a relative
// DATABASE_URL against the current directory and creates a stray server/dev.db.
pinSqliteUrl(path.resolve(__dirname, 'prisma'));

export default defineConfig({
  experimental: {
    adapter: true,
  },
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
  engine: 'js',
  async adapter() {
    return new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  },
});
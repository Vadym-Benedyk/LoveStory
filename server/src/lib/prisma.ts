import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { env, isProd } from '../config/env.js';
import { pinSqliteUrl } from './sqlite-path.js';

// Pin the SQLite file to server/prisma/dev.db regardless of the working directory, so the
// app, the CLI and the seed all open the same database file (avoids a stray empty ./dev.db).
// This module lives at src/lib (dev) or dist/lib (prod); prisma/ is two levels up.
const prismaDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prisma');
pinSqliteUrl(prismaDir);

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
  log: isProd || env.NODE_ENV === 'test' ? ['warn', 'error'] : ['query', 'warn', 'error'],
});

import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env.js';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: isProd ? ['warn', 'error'] : ['query', 'warn', 'error'],
});

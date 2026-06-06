import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { startExpiryJob } from './jobs/expiry.job.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
  startExpiryJob();
});

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

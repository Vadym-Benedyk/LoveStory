import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { apiRouter } from './routes.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.use('/api', apiRouter);

  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } }));
  app.use(errorHandler);

  return app;
}

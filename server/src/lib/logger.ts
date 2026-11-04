import pino from 'pino';
import { env, isProd } from '../config/env.js';

const isTest = env.NODE_ENV === 'test';

export const logger = pino({
  level: isTest ? 'silent' : isProd ? 'info' : 'debug',
  transport:
    isProd || isTest
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  base: { env: env.NODE_ENV },
});

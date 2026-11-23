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
  // pino-http logs every request's headers: keep the admin's access token (Authorization) and the
  // refresh-token cookie (Cookie on the way in, Set-Cookie on login) out of the logs.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[redacted]',
  },
});

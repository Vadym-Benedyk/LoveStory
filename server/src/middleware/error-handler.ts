import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() },
    });
  }
  if (err instanceof AppError) {
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}

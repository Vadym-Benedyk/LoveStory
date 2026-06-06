// Typed application errors. Controllers throw these; the central error handler maps them to HTTP.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'APP_ERROR',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const BadRequest = (msg: string, details?: unknown) =>
  new AppError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED');
export const Forbidden = (msg = 'Forbidden') => new AppError(403, msg, 'FORBIDDEN');
export const NotFound = (msg = 'Not found') => new AppError(404, msg, 'NOT_FOUND');
export const Conflict = (msg: string, details?: unknown) =>
  new AppError(409, msg, 'CONFLICT', details);
export const TooMany = (msg = 'Too many requests') => new AppError(429, msg, 'RATE_LIMITED');

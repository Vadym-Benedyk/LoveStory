import rateLimit from 'express-rate-limit';

// Each limiter is its own instance with its own in-memory counter, so traffic on one endpoint
// never eats another endpoint's budget (previously /quote, /bookings and /reviews shared one
// 20/hour counter, and a guest clicking around the calendar could lock themselves out of
// submitting). Counters are per client IP — see TRUST_PROXY in config/env.ts for running
// behind a reverse proxy.
const limiter = (windowMinutes: number, max: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
  });

// Brute-force protection for anything that checks a password.
export const loginLimiter = limiter(15, 10, 'Too many attempts, try later.');
export const passwordChangeLimiter = limiter(15, 10, 'Too many attempts, try later.');

// Price quotes are read-only and fire on every calendar click: generous, just anti-abuse.
export const quoteLimiter = limiter(15, 300, 'Too many requests, try later.');

// Spam protection on public submissions. A real guest sends one or two.
export const bookingRequestLimiter = limiter(60, 20, 'Too many booking requests, try later.');
export const reviewSubmitLimiter = limiter(60, 10, 'Too many reviews, try later.');

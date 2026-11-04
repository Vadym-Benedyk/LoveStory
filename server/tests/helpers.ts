// Shared helpers for HTTP-level integration tests (real Express app + real SQLite file).
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import type { Role } from '../src/middleware/auth.js';

export { prisma };

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const server: Server = createApp().listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/api`,
    close: () => new Promise((r) => server.close(() => r())),
  };
}

// Wipe every table (children first). Cheap on SQLite and keeps tests independent.
export async function resetDb() {
  await prisma.$transaction([
    prisma.bookingAddon.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.calendarBlock.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.media.deleteMany(),
    prisma.review.deleteMany(),
    prisma.addon.deleteMany(),
    prisma.priceRule.deleteMany(),
    prisma.contentBlock.deleteMany(),
    prisma.siteSettings.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  // Minimal data the booking flow needs: a base nightly rate and the settings singleton.
  await prisma.priceRule.create({ data: { name: 'Base', kind: 'BASE', nightlyRateMinor: 10_000 } });
  await prisma.siteSettings.create({ data: { id: 'default', capacity: 4 } });
}

// Users are created directly and tokens signed with the test secret, so tests don't go through
// /login (which is rate-limited to 10 attempts per 15 min).
export async function createUser(role: Role, email = `${role.toLowerCase()}@test.local`) {
  const user = await prisma.user.create({
    data: { email, name: role, role, passwordHash: 'x' },
  });
  const token = jwt.sign({ id: user.id, role, email }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: '1h',
  });
  return { user, token };
}

// YYYY-MM-DD, `n` days from today (UTC) — keeps stays in the future whenever tests run.
export function day(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function call<T = any>(
  srv: TestServer,
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: T }> {
  const res = await fetch(srv.url + path, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}

export const bookingRequest = (checkIn: string, checkOut: string, over: Record<string, unknown> = {}) => ({
  guestName: 'Test Guest',
  guestPhone: '+380500000000',
  guestsCount: 2,
  checkIn,
  checkOut,
  consent: true,
  ...over,
});

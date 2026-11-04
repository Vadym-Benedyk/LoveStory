// Rate limits are per purpose and per client IP. Each test file gets fresh module state, so the
// in-memory counters start at zero here.
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { bookingRequest, call, day, resetDb, type TestServer } from './helpers.js';

async function start(trustProxy: number): Promise<TestServer> {
  const server = createApp({ trustProxy }).listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/api`, close: () => new Promise((r) => server.close(() => r())) };
}

// Invalid on purpose (no consent): the limiter runs before validation and counts it, but no
// rows are created.
const badBooking = { ...bookingRequest(day(10), day(12)), consent: false };

const post = (srv: TestServer, path: string, body: unknown, ip?: string) =>
  fetch(srv.url + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(ip ? { 'x-forwarded-for': ip } : {}) },
    body: JSON.stringify(body),
  }).then((r) => r.status);

beforeEach(async () => {
  await resetDb();
});

describe('direct connection (TRUST_PROXY=0)', () => {
  let srv: TestServer;
  beforeAll(async () => {
    srv = await start(0);
  });
  afterAll(async () => {
    await srv.close();
  });

  it('price quotes do not use up the booking-request budget', async () => {
    // A guest clicking around the calendar: many quotes…
    for (let i = 0; i < 40; i++) {
      expect(await post(srv, '/quote', { checkIn: day(10), checkOut: day(12 + (i % 5)) })).toBe(200);
    }
    // …can still submit their request.
    const res = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(10), day(12)) });
    expect(res.status).toBe(201);
  });

  it('caps booking requests per IP, ignores spoofed X-Forwarded-For, and leaves reviews alone', async () => {
    // 1 request already made in the previous test; spoofed IPs must not reset the budget.
    for (let i = 0; i < 19; i++) expect(await post(srv, '/bookings', badBooking, `10.0.0.${i}`)).toBe(400);
    expect(await post(srv, '/bookings', badBooking, '10.0.0.99')).toBe(429);

    // Other public endpoints keep their own budgets.
    expect(await post(srv, '/quote', { checkIn: day(10), checkOut: day(12) })).toBe(200);
    expect(await post(srv, '/reviews', { authorName: 'Guest', rating: 5, body: 'Lovely place' })).toBe(201);
  });
});

describe('behind one reverse proxy (TRUST_PROXY=1)', () => {
  let srv: TestServer;
  beforeAll(async () => {
    srv = await start(1);
  });
  afterAll(async () => {
    await srv.close();
  });

  it('counts each visitor separately instead of the proxy as one client', async () => {
    // 'visitor A' uses up the remaining budget (the limiter instance is shared with the tests
    // above, which spent it from 127.0.0.1 — a different key).
    for (let i = 0; i < 20; i++) expect(await post(srv, '/bookings', badBooking, '203.0.113.1')).toBe(400);
    expect(await post(srv, '/bookings', badBooking, '203.0.113.1')).toBe(429);
    // Another visitor behind the same proxy is unaffected.
    expect(await post(srv, '/bookings', badBooking, '203.0.113.2')).toBe(400);
  });
});

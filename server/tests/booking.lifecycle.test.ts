// Booking lifecycle against the real API + SQLite: request → confirm → block, the state machine
// from docs/product-design.md §4, and the "no double booking" guarantee (risk #1 in the plan).
//
// Note: POST /bookings is rate-limited (20/hour per IP, in-memory per test file), so setup that
// isn't about the public endpoint creates rows directly via `pending()`.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expireStalePending } from '../src/modules/booking/booking.service.js';
import {
  bookingRequest,
  call,
  createUser,
  day,
  prisma,
  resetDb,
  startServer,
  type TestServer,
} from './helpers.js';

let srv: TestServer;
let owner: string;

beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await srv.close();
});
beforeEach(async () => {
  await resetDb();
  owner = (await createUser('OWNER')).token;
});

const unavailable = async (from: string, to: string) =>
  (await call<{ unavailable: { start: string; end: string; kind: string }[] }>(
    srv,
    'GET',
    `/availability?from=${from}&to=${to}`,
  )).body.unavailable;

let refSeq = 0;
async function pending(checkIn: string, checkOut: string, over: { createdAt?: Date } = {}) {
  return prisma.booking.create({
    data: {
      reference: `T${++refSeq}`.padEnd(8, '0'),
      guestName: 'Seeded',
      guestPhone: '+380500000001',
      checkIn: new Date(`${checkIn}T00:00:00Z`),
      checkOut: new Date(`${checkOut}T00:00:00Z`),
      status: 'PENDING',
      priceQuoteMinor: 0,
      ...over,
    },
  });
}

const confirm = (id: string, token = owner) => call(srv, 'POST', `/admin/bookings/${id}/confirm`, { token });
const setStatus = (id: string, status: string, token = owner) =>
  call(srv, 'PATCH', `/admin/bookings/${id}/status`, { token, body: { status } });

// ---------------------------------------------------------------------------

describe('guest request', () => {
  it('creates a PENDING request with a price snapshot and does not block the calendar', async () => {
    const res = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(10), day(13)) });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.reference).toMatch(/^[A-Z0-9]{8}$/);

    const row = await prisma.booking.findUniqueOrThrow({ where: { reference: res.body.reference } });
    expect(row.priceQuoteMinor).toBe(3 * 10_000); // 3 nights × base rate, frozen at request time

    expect(await unavailable(day(0), day(60))).toEqual([]);
  });

  it('accepts overlapping requests while they are only pending', async () => {
    const a = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(10), day(13)) });
    const b = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(11), day(14)) });
    expect([a.status, b.status]).toEqual([201, 201]);
  });

  it.each([
    ['check-in in the past', bookingRequest(day(-1), day(2))],
    ['check-out not after check-in', bookingRequest(day(10), day(10))],
    ['missing consent', bookingRequest(day(10), day(12), { consent: false })],
    ['honeypot filled (bot)', bookingRequest(day(10), day(12), { website: 'http://spam' })],
    ['more guests than capacity (4)', bookingRequest(day(10), day(12), { guestsCount: 5 })],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await call(srv, 'POST', '/bookings', { body });
    expect(res.status).toBe(400);
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe('confirmation blocks dates', () => {
  it('confirmed stay shows as unavailable and rejects new overlapping requests', async () => {
    const b = await pending(day(10), day(13));
    const res = await confirm(b.id);
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CONFIRMED');

    expect(await unavailable(day(0), day(60))).toEqual([{ start: day(10), end: day(13), kind: 'BOOKING' }]);

    const overlapping = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(12), day(15)) });
    expect(overlapping.status).toBe(409);
  });

  it('allows back-to-back stays (check-out day = next check-in day)', async () => {
    await confirm((await pending(day(10), day(13))).id);
    const before = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(8), day(10)) });
    const after = await call(srv, 'POST', '/bookings', { body: bookingRequest(day(13), day(15)) });
    expect([before.status, after.status]).toEqual([201, 201]);
  });

  it('refuses to confirm a second overlapping request and flags conflicts on confirm', async () => {
    const a = await pending(day(10), day(13));
    const b = await pending(day(12), day(14));
    const c = await pending(day(20), day(22)); // unrelated

    const first = await confirm(a.id);
    expect(first.status).toBe(200);
    expect(first.body.conflictingPendingIds).toEqual([b.id]);

    const second = await confirm(b.id);
    expect(second.status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('PENDING');
    expect((await confirm(c.id)).status).toBe(200);
  });

  it('never double-books under concurrent confirms of overlapping requests', async () => {
    const reqs = await Promise.all([
      pending(day(30), day(33)),
      pending(day(31), day(34)),
      pending(day(32), day(35)),
      pending(day(30), day(31)),
    ]);
    const results = await Promise.all(reqs.map((r) => confirm(r.id)));

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(3);
    expect(await prisma.booking.count({ where: { status: 'CONFIRMED' } })).toBe(1);
  });

  it('writes an attributed audit entry for the confirmation', async () => {
    const b = await pending(day(10), day(12));
    await confirm(b.id);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: b.id } });
    expect(log.action).toBe('BOOKING_CONFIRMED');
    expect(log.actorId).toBeTruthy();
  });
});

describe('manual calendar blocks', () => {
  it('block hides dates, rejects requests and confirmations; removing it reopens them', async () => {
    const p = await pending(day(10), day(12));
    const block = await call(srv, 'POST', '/admin/calendar/blocks', {
      token: owner,
      body: { startDate: day(11), endDate: day(15), reason: 'Repairs' },
    });
    expect(block.status).toBe(201);

    expect(await unavailable(day(0), day(60))).toEqual([{ start: day(11), end: day(15), kind: 'BLOCK' }]);
    expect((await call(srv, 'POST', '/bookings', { body: bookingRequest(day(14), day(16)) })).status).toBe(409);
    expect((await confirm(p.id)).status).toBe(409);

    const del = await call(srv, 'DELETE', `/admin/calendar/blocks/${block.body.id}`, { token: owner });
    expect(del.status).toBe(200);
    expect(await unavailable(day(0), day(60))).toEqual([]);
    expect((await confirm(p.id)).status).toBe(200);
  });
});

describe('status state machine (product-design §4)', () => {
  it('cancelling a confirmed stay reopens its dates', async () => {
    const b = await pending(day(10), day(13));
    await confirm(b.id);
    const res = await setStatus(b.id, 'CANCELLED');
    expect(res.status).toBe(200);
    expect(res.body.booking.status).toBe('CANCELLED');
    expect(await unavailable(day(0), day(60))).toEqual([]);
  });

  it('a declined request can no longer be confirmed', async () => {
    const b = await pending(day(10), day(13));
    expect((await setStatus(b.id, 'DECLINED')).status).toBe(200);
    expect((await confirm(b.id)).status).toBe(409);
  });

  it.each([
    ['decline a CONFIRMED stay (must be cancelled instead)', 'CONFIRMED', 'DECLINED'],
    ['cancel a PENDING request (must be declined instead)', 'PENDING', 'CANCELLED'],
    ['cancel a DECLINED request', 'DECLINED', 'CANCELLED'],
    ['cancel an EXPIRED request', 'EXPIRED', 'CANCELLED'],
    ['decline an EXPIRED request', 'EXPIRED', 'DECLINED'],
    ['re-cancel a CANCELLED stay', 'CANCELLED', 'CANCELLED'],
  ])('refuses to %s', async (_label, from, to) => {
    const b = await pending(day(10), day(13));
    await prisma.booking.update({ where: { id: b.id }, data: { status: from } });
    const res = await setStatus(b.id, to);
    expect(res.status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(from);
  });

  it('returns 404 for an unknown booking', async () => {
    expect((await confirm('nope')).status).toBe(404);
    expect((await setStatus('nope', 'DECLINED')).status).toBe(404);
  });
});

describe('pending expiry job', () => {
  it('expires only PENDING requests older than PENDING_EXPIRY_DAYS', async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 86_400_000);
    const stale = await pending(day(10), day(12), { createdAt: eightDaysAgo });
    const fresh = await pending(day(20), day(22));
    const oldConfirmed = await pending(day(30), day(32), { createdAt: eightDaysAgo });
    await confirm(oldConfirmed.id);

    expect(await expireStalePending()).toBe(1);

    const statuses = Object.fromEntries(
      (await prisma.booking.findMany()).map((b) => [b.id, b.status]),
    );
    expect(statuses).toEqual({
      [stale.id]: 'EXPIRED',
      [fresh.id]: 'PENDING',
      [oldConfirmed.id]: 'CONFIRMED',
    });
  });
});

describe('admin booking endpoints access', () => {
  it('require a token and an OWNER/MANAGER role', async () => {
    const b = await pending(day(10), day(12));
    expect((await call(srv, 'GET', '/admin/bookings')).status).toBe(401);
    const editor = (await createUser('EDITOR')).token;
    expect((await confirm(b.id, editor)).status).toBe(403);
    const manager = (await createUser('MANAGER')).token;
    expect((await confirm(b.id, manager)).status).toBe(200);
  });
});

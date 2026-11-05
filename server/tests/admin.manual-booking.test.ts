// Admin "new booking" (POST /admin/bookings): phone/walk-in guests entered by the owner.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { periodRange } from '../src/modules/booking/booking.service.js';
import { call, createUser, day, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let owner: string;

beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await srv.close();
});
beforeEach(async () => {
  await resetDb(); // base rate 10 000 minor (100 грн) per night
  owner = (await createUser('OWNER')).token;
});

const manual = (checkIn: string, checkOut: string, over: Record<string, unknown> = {}) => ({
  guestName: 'Іван Телефонний',
  guestPhone: '+380 (67) 123-45-67',
  guestsCount: 3,
  checkIn,
  checkOut,
  ...over,
});
const create = (body: unknown, token = owner) => call(srv, 'POST', '/admin/bookings', { token, body });
const unavailable = async () =>
  (await call<{ unavailable: unknown[] }>(srv, 'GET', `/availability?from=${day(0)}&to=${day(90)}`)).body
    .unavailable;

describe('manual booking', () => {
  it('is confirmed by default, priced by the rules, blocks the dates and is audit-logged', async () => {
    const res = await create(manual(day(10), day(13), { internalNotes: 'Дзвонив у понеділок' }));
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({
      status: 'CONFIRMED',
      source: 'MANUAL',
      guestPhone: '+380671234567',
      guestsCount: 3,
      priceQuoteMinor: 3 * 10_000,
      currency: 'UAH',
      internalNotes: 'Дзвонив у понеділок',
    });
    expect(res.body.booking.confirmedAt).toBeTruthy();
    expect(res.body.quotedMinor).toBe(30_000);

    expect(await unavailable()).toEqual([{ start: day(10), end: day(13), kind: 'BOOKING' }]);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: res.body.booking.id } });
    expect(log.action).toBe('BOOKING_CREATED_MANUAL');
  });

  it('stores an owner-set price instead of the quote', async () => {
    const res = await create(manual(day(10), day(12), { priceMinor: 15_000 }));
    expect(res.body.booking.priceQuoteMinor).toBe(15_000);
    expect(res.body.quotedMinor).toBe(20_000);
  });

  it('can be created as pending — then it does not block the calendar', async () => {
    const res = await create(manual(day(10), day(12), { status: 'PENDING' }));
    expect(res.body.booking).toMatchObject({ status: 'PENDING', source: 'MANUAL', confirmedAt: null });
    expect(await unavailable()).toEqual([]);
  });

  it('refuses dates taken by a confirmed booking or a manual block', async () => {
    expect((await create(manual(day(10), day(13)))).status).toBe(201);
    expect((await create(manual(day(12), day(14)))).status).toBe(409);
    expect((await create(manual(day(12), day(14), { status: 'PENDING' }))).status).toBe(409);

    await call(srv, 'POST', '/admin/calendar/blocks', {
      token: owner,
      body: { startDate: day(20), endDate: day(22) },
    });
    expect((await create(manual(day(21), day(23)))).status).toBe(409);
    expect((await create(manual(day(13), day(15)))).status).toBe(201); // back-to-back is fine
  });

  it('never double-books under concurrent creation', async () => {
    const results = await Promise.all([
      create(manual(day(30), day(33))),
      create(manual(day(31), day(34))),
      create(manual(day(32), day(35))),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.booking.count({ where: { status: 'CONFIRMED' } })).toBe(1);
  });

  it('flags website requests waiting on the same dates', async () => {
    const waiting = await prisma.booking.create({
      data: {
        reference: 'WAITING1',
        guestName: 'З сайту',
        guestPhone: '+380500000001',
        checkIn: new Date(`${day(10)}T00:00:00Z`),
        checkOut: new Date(`${day(12)}T00:00:00Z`),
        priceQuoteMinor: 0,
      },
    });
    const res = await create(manual(day(11), day(13)));
    expect(res.body.conflictingPendingIds).toEqual([waiting.id]);
  });

  it.each([
    ['check-in in the past', manual(day(-2), day(1))],
    ['check-out not after check-in', manual(day(10), day(10))],
    ['invalid phone', manual(day(10), day(12), { guestPhone: '123' })],
    ['negative price', manual(day(10), day(12), { priceMinor: -1 })],
  ])('rejects %s with 400', async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(await prisma.booking.count()).toBe(0);
  });

  it('is available to OWNER and MANAGER only', async () => {
    expect((await call(srv, 'POST', '/admin/bookings', { body: manual(day(10), day(12)) })).status).toBe(401);
    expect((await create(manual(day(10), day(12)), (await createUser('EDITOR')).token)).status).toBe(403);
    expect((await create(manual(day(10), day(12)), (await createUser('MANAGER')).token)).status).toBe(201);
  });
});

describe('booking notes', () => {
  it('owner/manager can edit the private note; it is trimmed, clearable and audit-logged', async () => {
    const { body } = await create(manual(day(10), day(12)));
    const id = body.booking.id;
    const patch = (internalNotes: string | null, token = owner) =>
      call(srv, 'PATCH', `/admin/bookings/${id}`, { token, body: { internalNotes } });

    expect((await patch('  Передоплата 1000 грн  ')).body.internalNotes).toBe('Передоплата 1000 грн');
    const manager = (await createUser('MANAGER')).token;
    expect((await patch('Приїдуть пізно', manager)).status).toBe(200);
    expect((await patch('')).body.internalNotes).toBeNull();

    const list = await call<any[]>(srv, 'GET', '/admin/bookings', { token: owner });
    expect(list.body[0].confirmedBy).toEqual({ name: 'OWNER', email: 'owner@test.local' });
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id } })).map((l) => l.action);
    expect(actions.filter((a) => a === 'BOOKING_NOTES_UPDATED')).toHaveLength(3);
  });

  it('rejects unknown bookings, too-long notes and editors', async () => {
    const { body } = await create(manual(day(10), day(12)));
    expect((await call(srv, 'PATCH', '/admin/bookings/nope', { token: owner, body: { internalNotes: 'x' } })).status).toBe(404);
    expect(
      (await call(srv, 'PATCH', `/admin/bookings/${body.booking.id}`, { token: owner, body: { internalNotes: 'x'.repeat(2001) } }))
        .status,
    ).toBe(400);
    const editor = (await createUser('EDITOR')).token;
    expect((await call(srv, 'PATCH', `/admin/bookings/${body.booking.id}`, { token: editor, body: { internalNotes: 'x' } })).status).toBe(403);
  });
});

describe('bookings list filters', () => {
  const seed = (ref: string, checkIn: string, status = 'PENDING') =>
    prisma.booking.create({
      data: {
        reference: ref,
        guestName: ref,
        guestPhone: '+380500000001',
        checkIn: new Date(`${checkIn}T00:00:00Z`),
        checkOut: new Date(new Date(`${checkIn}T00:00:00Z`).getTime() + 86_400_000),
        priceQuoteMinor: 0,
        status,
      },
    });
  const refs = async (qs: string) =>
    (await call<{ reference: string }[]>(srv, 'GET', `/admin/bookings${qs}`, { token: owner })).body.map(
      (b) => b.reference,
    );

  it('periodRange: calendar week (Mon–Sun), month and year around a given day', () => {
    const wed = new Date('2026-11-04T15:00:00Z'); // a Wednesday
    const iso = (r: { from: Date; to: Date }) => [r.from, r.to].map((d) => d.toISOString().slice(0, 10));
    expect(iso(periodRange('day', wed))).toEqual(['2026-11-04', '2026-11-05']);
    expect(iso(periodRange('week', wed))).toEqual(['2026-11-02', '2026-11-09']);
    expect(iso(periodRange('week', new Date('2026-11-08T10:00:00Z')))).toEqual(['2026-11-02', '2026-11-09']); // Sunday
    expect(iso(periodRange('week', new Date('2026-11-09T00:00:00Z')))).toEqual(['2026-11-09', '2026-11-16']); // Monday
    expect(iso(periodRange('month', wed))).toEqual(['2026-11-01', '2026-12-01']);
    expect(iso(periodRange('month', new Date('2026-12-31T23:00:00Z')))).toEqual(['2026-12-01', '2027-01-01']);
    expect(iso(periodRange('year', wed))).toEqual(['2026-01-01', '2027-01-01']);
  });

  it('filters by CHECK-IN date, combinable with status, sorted by check-in (earliest first)', async () => {
    await seed('LATER000', day(400));
    await seed('TODAY000', day(0), 'DECLINED');
    await seed('EARLIER0', day(-400));
    await seed('FAR00000', day(800));

    // Sorted by check-in regardless of creation order.
    expect(await refs('')).toEqual(['EARLIER0', 'TODAY000', 'LATER000', 'FAR00000']);
    // Today always lies in the current week / month / year; the ±400-day ones never do.
    for (const period of ['day', 'week', 'month', 'year']) expect(await refs(`?period=${period}`)).toEqual(['TODAY000']);
    expect(await refs('?period=year&status=DECLINED')).toEqual(['TODAY000']);
    expect(await refs('?period=year&status=PENDING')).toEqual([]);
  });

  it('puts bookings with the same check-in newest-request first', async () => {
    const older = await seed('OLDER000', day(5));
    await prisma.booking.update({ where: { id: older.id }, data: { createdAt: new Date(Date.now() - 86_400_000) } });
    await seed('NEWER000', day(5));
    expect(await refs('')).toEqual(['NEWER000', 'OLDER000']);
  });

  it('rejects an unknown period or status', async () => {
    expect((await call(srv, 'GET', '/admin/bookings?period=decade', { token: owner })).status).toBe(400);
    expect((await call(srv, 'GET', '/admin/bookings?status=NOPE', { token: owner })).status).toBe(400);
  });
});

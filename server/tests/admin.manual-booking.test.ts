// Admin "new booking" (POST /admin/bookings): phone/walk-in guests entered by the owner.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const seed = (ref: string, createdAt: Date, status = 'PENDING') =>
    prisma.booking.create({
      data: {
        reference: ref,
        guestName: ref,
        guestPhone: '+380500000001',
        checkIn: new Date(`${day(40)}T00:00:00Z`),
        checkOut: new Date(`${day(41)}T00:00:00Z`),
        priceQuoteMinor: 0,
        createdAt,
        status,
      },
    });
  const refs = async (qs: string) =>
    (await call<{ reference: string }[]>(srv, 'GET', `/admin/bookings${qs}`, { token: owner })).body
      .map((b) => b.reference)
      .sort();

  it('filters by the period the booking was created in, combinable with status', async () => {
    await seed('TODAY000', daysAgo(0));
    await seed('WEEK0006', daysAgo(6));
    await seed('MONTH020', daysAgo(20), 'DECLINED');
    await seed('YEAR0200', daysAgo(200), 'DECLINED');
    await seed('OLD00800', daysAgo(800));

    expect(await refs('')).toHaveLength(5);
    expect(await refs('?period=week')).toEqual(['TODAY000', 'WEEK0006']);
    expect(await refs('?period=month')).toEqual(['MONTH020', 'TODAY000', 'WEEK0006']);
    expect(await refs('?period=year')).toEqual(['MONTH020', 'TODAY000', 'WEEK0006', 'YEAR0200']);
    expect(await refs('?period=year&status=DECLINED')).toEqual(['MONTH020', 'YEAR0200']);
  });

  it('rejects an unknown period or status', async () => {
    expect((await call(srv, 'GET', '/admin/bookings?period=decade', { token: owner })).status).toBe(400);
    expect((await call(srv, 'GET', '/admin/bookings?status=NOPE', { token: owner })).status).toBe(400);
  });
});

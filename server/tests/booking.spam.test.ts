// Spam limits of the public booking form (booking.service.ts): re-sends, open requests per phone,
// and the hourly cap on owner alerts.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAX_OPEN_REQUESTS_PER_PHONE, OWNER_ALERTS_PER_HOUR } from '../src/modules/booking/booking.service.js';
import { bookingRequest, call, day, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await srv.close();
});
beforeEach(resetDb);

const request = (checkIn: string, checkOut: string, over: Record<string, unknown> = {}) =>
  call(srv, 'POST', '/bookings', { body: bookingRequest(checkIn, checkOut, over) });

describe('booking form spam limits', () => {
  it('the same request sent twice is stored once and answers with the same reference', async () => {
    const a = await request(day(10), day(12));
    const b = await request(day(10), day(12));
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(b.body.reference).toBe(a.body.reference);
    expect(await prisma.booking.count()).toBe(1);
  });

  it(`one phone can have at most ${MAX_OPEN_REQUESTS_PER_PHONE} requests waiting`, async () => {
    for (let i = 0; i < MAX_OPEN_REQUESTS_PER_PHONE; i++) {
      expect((await request(day(10 + i * 3), day(12 + i * 3))).status).toBe(201);
    }
    const over = await request(day(40), day(42));
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('TOO_MANY_OPEN_REQUESTS');

    // Another guest is not affected, and a handled request no longer counts.
    expect((await request(day(40), day(42), { guestPhone: '+380501112233' })).status).toBe(201);
    await prisma.booking.updateMany({ where: { guestPhone: '+380500000000' }, data: { status: 'DECLINED' } });
    expect((await request(day(40), day(42))).status).toBe(201);
  });

  it('past the hourly alert limit requests are still stored (only the owner alerts pause)', async () => {
    await prisma.booking.createMany({
      data: Array.from({ length: OWNER_ALERTS_PER_HOUR }, (_, i) => ({
        reference: `FLOOD${String(i).padStart(3, '0')}`,
        guestName: 'Bot',
        guestPhone: `+38050${String(1_000_000 + i)}`,
        checkIn: new Date(`${day(10)}T00:00:00Z`),
        checkOut: new Date(`${day(12)}T00:00:00Z`),
        status: 'PENDING',
        source: 'WEBSITE',
        priceQuoteMinor: 0,
      })),
    });
    const res = await request(day(20), day(22));
    expect(res.status).toBe(201);
    expect(await prisma.booking.count()).toBe(OWNER_ALERTS_PER_HOUR + 1);
  });
});

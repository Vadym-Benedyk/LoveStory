// Review invitations: after a stay, a one-off link is the only way to leave a review.
// Covers the hourly job's selection, the public invite endpoints (open / used / expired / unknown),
// the "verified" flag on the public list and the admin re-send action.
//
// POST /reviews/invite/:token is rate-limited (10/hour per IP, in-memory per test file): this file
// makes well under 10 submissions.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  INVITE_TTL_DAYS,
  inviteRecentCheckouts,
  sendInvite,
} from '../src/modules/reviews/review-invite.service.js';
import { resolveGuestReplyTo } from '../src/lib/notify.js';
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
  await resetDb();
  owner = (await createUser('OWNER')).token;
});

let refSeq = 0;
// A CONFIRMED stay whose check-out was `daysAgo` days ago (0 = today).
async function stay(daysAgo: number, over: Record<string, unknown> = {}) {
  return prisma.booking.create({
    data: {
      reference: `R${++refSeq}`.padEnd(8, '0'),
      guestName: 'Олена Коваленко',
      guestPhone: '+380500000001',
      checkIn: new Date(`${day(-daysAgo - 2)}T00:00:00Z`),
      checkOut: new Date(`${day(-daysAgo)}T00:00:00Z`),
      status: 'CONFIRMED',
      priceQuoteMinor: 20_000,
      ...over,
    },
  });
}

const noon = (daysAfterToday: number) => new Date(`${day(daysAfterToday)}T13:00:00Z`);

describe('the hourly job', () => {
  it('invites confirmed stays once their check-out day is under way, once each', async () => {
    const done = await stay(1);
    const today = await stay(0);
    const old = await stay(20); // too long ago: never invited by the job
    await stay(1, { status: 'PENDING' }); // not a stay
    const future = await stay(-3);

    // Early on the check-out day nothing is due yet for `today`.
    expect(await inviteRecentCheckouts(new Date(`${day(0)}T03:00:00Z`))).toBe(1);
    expect(await inviteRecentCheckouts(noon(0))).toBe(1);
    expect(await inviteRecentCheckouts(noon(0))).toBe(0); // idempotent

    const rows = await prisma.booking.findMany({ orderBy: { reference: 'asc' } });
    const byId = Object.fromEntries(rows.map((b) => [b.id, b]));
    for (const b of [done, today]) {
      expect(byId[b.id]!.reviewInviteToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(byId[b.id]!.reviewInvitedAt).toBeInstanceOf(Date);
      // No SMTP / Telegram in tests: the link is left for the owner to send by hand.
      expect(byId[b.id]!.reviewInviteChannel).toBe('MANUAL');
    }
    for (const b of [old, future]) expect(byId[b.id]!.reviewInviteToken).toBeNull();
  });
});

describe('the invitation link', () => {
  it('shows the stay, accepts one review (pending, verified) and then reports it as used', async () => {
    const b = await stay(1);
    const { token, link } = await sendInvite(b.id);
    expect(link).toBe(`http://localhost:5173/review/${token}`);

    const view = await call(srv, 'GET', `/reviews/invite/${token}`);
    expect(view.status).toBe(200);
    expect(view.body).toMatchObject({ state: 'OPEN', guestFirstName: 'Олена' });
    // Never the guest's contacts.
    expect(JSON.stringify(view.body)).not.toContain('+380');

    const submit = await call(srv, 'POST', `/reviews/invite/${token}`, {
      body: { rating: 5, body: 'Тиша, річка і чудовий будинок.' },
    });
    expect(submit.status).toBe(201);
    expect(submit.body.status).toBe('PENDING');

    const review = await prisma.review.findUniqueOrThrow({ where: { id: submit.body.id } });
    expect(review).toMatchObject({
      bookingId: b.id,
      authorName: 'Олена', // first name by default
      status: 'PENDING',
      source: 'WEBSITE',
      stayMonth: b.checkIn.toISOString().slice(0, 7),
    });

    // Pending: not public yet. Approved: public and marked as a verified stay.
    expect((await call(srv, 'GET', '/reviews')).body.reviews).toEqual([]);
    await call(srv, 'PATCH', `/admin/reviews/${review.id}`, { token: owner, body: { status: 'APPROVED' } });
    const pub = (await call(srv, 'GET', '/reviews')).body.reviews;
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ authorName: 'Олена', verified: true });
    expect(pub[0]).not.toHaveProperty('bookingId');

    // The link is spent.
    expect((await call(srv, 'GET', `/reviews/invite/${token}`)).body.state).toBe('USED');
    const again = await call(srv, 'POST', `/reviews/invite/${token}`, { body: { rating: 4, body: 'Ще один відгук' } });
    expect(again.status).toBe(409);
    expect(await prisma.review.count()).toBe(1);

    // The admin list says which stay a review belongs to.
    const admin = await call(srv, 'GET', '/admin/reviews', { token: owner });
    expect(admin.body.reviews[0].booking).toMatchObject({ reference: b.reference });
  });

  it('lets the guest choose the displayed name and validates the form', async () => {
    const b = await stay(1);
    const { token } = await sendInvite(b.id);
    expect(
      (await call(srv, 'POST', `/reviews/invite/${token}`, { body: { rating: 6, body: 'Чудово' } })).status,
    ).toBe(400);
    expect(
      (await call(srv, 'POST', `/reviews/invite/${token}`, { body: { rating: 5, body: 'ок' } })).status,
    ).toBe(400);
    const ok = await call(srv, 'POST', `/reviews/invite/${token}`, {
      body: { authorName: ' Олена К. ', rating: 4, title: ' Гарне місце ', body: ' Нам сподобалось. ' },
    });
    expect(ok.status).toBe(201);
    expect(await prisma.review.findUniqueOrThrow({ where: { id: ok.body.id } })).toMatchObject({
      authorName: 'Олена К.',
      title: 'Гарне місце',
      body: 'Нам сподобалось.',
    });
  });

  it('expires after 60 days and is 404 when unknown', async () => {
    const b = await stay(1);
    const { token } = await sendInvite(b.id);
    await prisma.booking.update({
      where: { id: b.id },
      data: { reviewInvitedAt: new Date(Date.now() - (INVITE_TTL_DAYS + 1) * 86_400_000) },
    });
    expect((await call(srv, 'GET', `/reviews/invite/${token}`)).body.state).toBe('EXPIRED');
    expect((await call(srv, 'POST', `/reviews/invite/${token}`, { body: { rating: 5, body: 'Запізно' } })).status).toBe(410);

    expect((await call(srv, 'GET', '/reviews/invite/abcdefghijklmnopqrstuvwxyz0123')).status).toBe(404);
    expect((await call(srv, 'GET', '/reviews/invite/short')).status).toBe(400);
  });
});

describe('admin re-send', () => {
  it('keeps the token, restarts the 60 days, refuses non-stays and reviewed stays', async () => {
    const b = await stay(1);
    const first = await sendInvite(b.id);
    await prisma.booking.update({
      where: { id: b.id },
      data: { reviewInvitedAt: new Date(Date.now() - 50 * 86_400_000) },
    });

    const res = await call(srv, 'POST', `/admin/bookings/${b.id}/review-invite`, { token: owner });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe(first.token);
    expect(res.body.link).toBe(first.link);
    expect(Date.now() - Date.parse(res.body.invitedAt)).toBeLessThan(60_000);
    expect(await prisma.auditLog.count({ where: { action: 'REVIEW_INVITE_SENT', entityId: b.id } })).toBe(1);

    // The list shows the invitation and, later, the review.
    let list = (await call(srv, 'GET', '/admin/bookings', { token: owner })).body;
    expect(list[0]).toMatchObject({ reviewInviteToken: first.token, reviewInviteChannel: 'MANUAL', review: null });

    await call(srv, 'POST', `/reviews/invite/${first.token}`, { body: { rating: 3, body: 'Нормально' } });
    list = (await call(srv, 'GET', '/admin/bookings', { token: owner })).body;
    expect(list[0].review).toMatchObject({ status: 'PENDING', rating: 3 });
    expect((await call(srv, 'POST', `/admin/bookings/${b.id}/review-invite`, { token: owner })).status).toBe(409);

    const pending = await stay(1, { status: 'PENDING' });
    expect((await call(srv, 'POST', `/admin/bookings/${pending.id}/review-invite`, { token: owner })).status).toBe(409);
    expect((await call(srv, 'POST', `/admin/bookings/${b.id}/review-invite`)).status).toBe(401);
  });
});

describe('reply-to of guest letters', () => {
  it('prefers the public contact email, then the owner notification address', async () => {
    expect(await resolveGuestReplyTo()).toBeUndefined(); // nothing configured (the test env has no NOTIFY_EMAIL)

    await prisma.siteSettings.update({ where: { id: 'default' }, data: { notificationEmail: 'owner@mail.test' } });
    expect(await resolveGuestReplyTo()).toBe('owner@mail.test');

    await prisma.siteSettings.update({ where: { id: 'default' }, data: { email: ' info@site.test ' } });
    expect(await resolveGuestReplyTo()).toBe('info@site.test');
  });
});

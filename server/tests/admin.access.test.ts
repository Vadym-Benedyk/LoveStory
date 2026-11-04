// Role guards and key behaviour of the admin modules added on top of booking: review moderation,
// settings and password change. Also locks in the route-mount-order fix (a MANAGER must not be
// caught by the bare '/admin' content router's OWNER/EDITOR guard).
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
let owner: string;
let manager: string;
let editor: string;

beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await srv.close();
});
beforeEach(async () => {
  await resetDb();
  owner = (await createUser('OWNER')).token;
  manager = (await createUser('MANAGER')).token;
  editor = (await createUser('EDITOR')).token;
});

describe('route guards', () => {
  it.each([
    // [method, path, OWNER, MANAGER, EDITOR]
    ['GET', '/admin/bookings', 200, 200, 403],
    ['GET', '/admin/reviews', 200, 200, 403],
    ['GET', '/admin/settings', 200, 403, 403],
    ['GET', '/admin/pricing', 200, 403, 403],
    ['GET', '/admin/content', 200, 403, 200],
  ])('%s %s → owner %i, manager %i, editor %i', async (method, path, o, m, e) => {
    expect((await call(srv, method, path)).status).toBe(401);
    expect((await call(srv, method, path, { token: owner })).status).toBe(o);
    expect((await call(srv, method, path, { token: manager })).status).toBe(m);
    expect((await call(srv, method, path, { token: editor })).status).toBe(e);
  });
});

describe('review moderation', () => {
  it('a submitted review stays private until approved, then shows with the owner reply', async () => {
    const submit = await call(srv, 'POST', '/reviews', {
      body: { authorName: 'Олена', rating: 5, body: 'Чудове місце біля річки' },
    });
    expect(submit.status).toBe(201);
    expect((await call(srv, 'GET', '/reviews')).body.reviews).toEqual([]);

    const id = submit.body.id;
    expect((await call(srv, 'PATCH', `/admin/reviews/${id}`, { token: manager, body: { status: 'APPROVED' } })).status).toBe(200);
    await call(srv, 'PATCH', `/admin/reviews/${id}`, { token: owner, body: { ownerReply: ' Дякуємо! ' } });

    const pub = (await call(srv, 'GET', '/reviews')).body;
    expect(pub.summary).toEqual({ count: 1, average: 5 });
    expect(pub.reviews[0]).toMatchObject({ authorName: 'Олена', ownerReply: 'Дякуємо!' });
    // Public payload carries no moderation fields.
    expect(pub.reviews[0]).not.toHaveProperty('status');
    expect(pub.reviews[0]).not.toHaveProperty('approvedById');
  });

  it('hiding withdraws the approval; delete is audit-logged', async () => {
    const r = await prisma.review.create({ data: { authorName: 'A', rating: 4, body: 'Ok stay', status: 'APPROVED' } });
    const hide = await call(srv, 'PATCH', `/admin/reviews/${r.id}`, { token: owner, body: { status: 'HIDDEN' } });
    expect(hide.body).toMatchObject({ status: 'HIDDEN', approvedAt: null, approvedById: null });

    expect((await call(srv, 'DELETE', `/admin/reviews/${r.id}`, { token: owner })).status).toBe(200);
    expect((await call(srv, 'DELETE', `/admin/reviews/${r.id}`, { token: owner })).status).toBe(404);
    expect((await prisma.auditLog.findMany({ where: { entityId: r.id } })).map((l) => l.action)).toEqual(
      expect.arrayContaining(['REVIEW_HIDDEN', 'REVIEW_DELETED']),
    );
  });
});

describe('settings', () => {
  it('only whitelisted fields can be written; the map is stored as a bare embed URL', async () => {
    const res = await call(srv, 'PUT', '/admin/settings', {
      token: owner,
      body: {
        phone: '+380501112233',
        mapEmbed: '<iframe src="https://www.google.com/maps/embed?pb=abc&amp;x=1"></iframe>',
        currency: 'XXX', // not writable
        notificationChannels: '{"evil":1}', // not writable
      },
    });
    expect(res.status).toBe(200);
    const row = await prisma.siteSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(row).toMatchObject({
      phone: '+380501112233',
      mapEmbed: 'https://www.google.com/maps/embed?pb=abc&x=1',
      currency: 'USD',
      notificationChannels: '{}',
    });
  });

  it('public /content exposes display fields only and drops non-embed map values', async () => {
    await prisma.siteSettings.update({
      where: { id: 'default' },
      data: { notificationEmail: 'secret@owner.test', mapEmbed: '<img src=x onerror=alert(1)>' },
    });
    const { settings } = (await call(srv, 'GET', '/content')).body;
    expect(settings).not.toHaveProperty('notificationEmail');
    expect(settings.mapEmbedUrl).toBeNull();
  });

  it('rejects a non-Google map value', async () => {
    const res = await call(srv, 'PUT', '/admin/settings', { token: owner, body: { mapEmbed: '<script>x</script>' } });
    expect(res.status).toBe(400);
  });
});

describe('password change', () => {
  it('requires the current password and then accepts the new one at login', async () => {
    const { user, token } = await createUser('MANAGER', 'pw@test.local');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash('OldPassword1', 4) } });

    const wrong = await call(srv, 'POST', '/admin/auth/password', {
      token,
      body: { currentPassword: 'nope', newPassword: 'NewPassword1' },
    });
    expect(wrong).toMatchObject({ status: 400, body: { error: { code: 'WRONG_PASSWORD' } } });

    const ok = await call(srv, 'POST', '/admin/auth/password', {
      token,
      body: { currentPassword: 'OldPassword1', newPassword: 'NewPassword1' },
    });
    expect(ok.status).toBe(200);

    const login = (password: string) =>
      call(srv, 'POST', '/admin/auth/login', { body: { email: 'pw@test.local', password } });
    expect((await login('OldPassword1')).status).toBe(401);
    expect((await login('NewPassword1')).status).toBe(200);
  });
});

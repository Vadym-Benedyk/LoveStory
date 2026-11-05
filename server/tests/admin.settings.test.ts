// Settings: "send booking notifications to the site email" flag and the resulting recipient.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';
import { resolveRecipientEmail } from '../src/lib/notify.js';

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

describe('notifyToSiteEmail', () => {
  it('defaults to off and is saved / returned by the admin API', async () => {
    const before = await call<{ notifyToSiteEmail: boolean }>(srv, 'GET', '/admin/settings', { token: owner });
    expect(before.body.notifyToSiteEmail).toBe(false);

    const put = await call<{ notifyToSiteEmail: boolean }>(srv, 'PUT', '/admin/settings', {
      token: owner,
      body: { notifyToSiteEmail: true },
    });
    expect(put.status).toBe(200);
    expect(put.body.notifyToSiteEmail).toBe(true);
    expect((await call<{ notifyToSiteEmail: boolean }>(srv, 'GET', '/admin/settings', { token: owner })).body.notifyToSiteEmail).toBe(true);
  });

  it('rejects a non-boolean value', async () => {
    const res = await call(srv, 'PUT', '/admin/settings', { token: owner, body: { notifyToSiteEmail: 'yes' } });
    expect(res.status).toBe(400);
  });

  it('is never exposed on the public /content endpoint', async () => {
    await call(srv, 'PUT', '/admin/settings', { token: owner, body: { notifyToSiteEmail: true } });
    const pub = await call<{ settings: Record<string, unknown> }>(srv, 'GET', '/content');
    expect(pub.body.settings).not.toHaveProperty('notifyToSiteEmail');
    expect(pub.body.settings).not.toHaveProperty('notificationEmail');
  });

  it('picks the recipient: own address, or the site email when the flag is on', async () => {
    await prisma.siteSettings.update({
      where: { id: 'default' },
      data: { email: 'site@test.local', notificationEmail: 'own@test.local' },
    });
    expect(await resolveRecipientEmail()).toBe('own@test.local');

    await prisma.siteSettings.update({ where: { id: 'default' }, data: { notifyToSiteEmail: true } });
    expect(await resolveRecipientEmail()).toBe('site@test.local');
  });
});

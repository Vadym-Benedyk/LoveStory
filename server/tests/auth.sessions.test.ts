// Admin sessions (modules/auth/auth.service.ts): logging out, changing the password or deactivating
// a user ends access at once, not when a token runs out.
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteDeadSessions } from '../src/modules/auth/auth.service.js';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';

let srv: TestServer;
beforeAll(async () => {
  srv = await startServer();
});
afterAll(async () => {
  await srv.close();
});
beforeEach(resetDb);

const EMAIL = 'owner@test.local';
const PASSWORD = 'first-password-1';

async function makeOwner() {
  return prisma.user.create({
    data: { email: EMAIL, name: 'Owner', role: 'OWNER', passwordHash: await bcrypt.hash(PASSWORD, 4) },
  });
}

// A signed-in browser: the access token and the refresh cookie the API set.
async function login(password = PASSWORD) {
  const res = await fetch(`${srv.url}/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!; // lovestory_rt=<token>
  const { accessToken } = (await res.json()) as { accessToken: string };
  return { accessToken, cookie };
}

const post = (path: string, cookie: string) =>
  fetch(`${srv.url}/admin/auth${path}`, { method: 'POST', headers: { cookie } });
const me = (token: string) => call(srv, 'GET', '/admin/auth/me', { token });

describe('admin sessions', () => {
  it('logout ends the session: the cookie no longer refreshes and the access token stops working', async () => {
    await makeOwner();
    const a = await login();
    expect((await me(a.accessToken)).status).toBe(200);
    expect((await post('/refresh', a.cookie)).status).toBe(200);

    expect((await post('/logout', a.cookie)).status).toBe(200);
    expect((await post('/refresh', a.cookie)).status).toBe(401);
    expect((await me(a.accessToken)).status).toBe(401);
  });

  it('a password change ends the other sessions and keeps the current one', async () => {
    await makeOwner();
    const here = await login();
    const other = await login();

    const res = await call(srv, 'POST', '/admin/auth/password', {
      token: here.accessToken,
      body: { currentPassword: PASSWORD, newPassword: 'second-password-2' },
    });
    expect(res.status).toBe(200);
    expect(res.body.endedSessions).toBe(1);

    expect((await me(other.accessToken)).status).toBe(401);
    expect((await post('/refresh', other.cookie)).status).toBe(401);
    expect((await me(here.accessToken)).status).toBe(200);
    expect((await post('/refresh', here.cookie)).status).toBe(200);
  });

  it('deactivating a user cuts off their current access token', async () => {
    const { user, token } = await createUser('MANAGER');
    expect((await call(srv, 'GET', '/admin/bookings', { token })).status).toBe(200);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect((await call(srv, 'GET', '/admin/bookings', { token })).status).toBe(401);
  });

  it('a role change applies at once, not when the token expires', async () => {
    const { user, token } = await createUser('MANAGER');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'EDITOR' } });
    expect((await call(srv, 'GET', '/admin/bookings', { token })).status).toBe(403);
  });

  it('refuses a token without a session (issued before sessions existed)', async () => {
    const { user } = await createUser('OWNER');
    const legacy = jwt.sign({ id: user.id, role: 'OWNER', email: user.email }, process.env.JWT_ACCESS_SECRET!);
    expect((await me(legacy)).status).toBe(401);
  });

  it('a wrong password and an unknown email get the same answer', async () => {
    await makeOwner();
    const attempt = (email: string) => call(srv, 'POST', '/admin/auth/login', { body: { email, password: 'nope-nope' } });
    const [wrong, unknown] = [await attempt(EMAIL), await attempt('nobody@test.local')];
    expect(wrong).toEqual(unknown);
    expect(wrong.status).toBe(401);
  });

  it('the hourly clean-up deletes expired sessions and keeps live ones', async () => {
    const { sid } = await createUser('OWNER');
    const { user } = await createUser('EDITOR');
    await prisma.adminSession.create({ data: { userId: user.id, expiresAt: new Date(Date.now() - 1000) } });
    expect(await deleteDeadSessions()).toBe(1);
    expect(await prisma.adminSession.findUnique({ where: { id: sid } })).not.toBeNull();
  });
});

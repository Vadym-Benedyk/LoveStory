// Bilingual tariffs / extras and the "what's included" list (admin CRUD + public /pricing).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createUser, prisma, resetDb, startServer, type TestServer } from './helpers.js';

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

const post = (path: string, body: unknown, token = owner) =>
  call(srv, 'POST', `/admin/pricing${path}`, { token: token || undefined, body });

describe('bilingual tariff and extra names', () => {
  it('requires both names and stores them as typed (trimmed)', async () => {
    const rule = { kind: 'SEASONAL', nightlyRateMinor: 500000, appliesFrom: '2026-12-20', appliesTo: '2027-01-08' };
    expect((await post('/rules', { ...rule, name: 'Новий рік' })).status).toBe(400); // no English name
    expect((await post('/rules', { ...rule, name: 'Новий рік', nameEn: '   ' })).status).toBe(400);

    const ok = await post('/rules', { ...rule, name: '  Новий рік ', nameEn: ' New Year ' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ name: 'Новий рік', nameEn: 'New Year' });

    const addon = await post('/addons', {
      name: 'Теплий чан',
      nameEn: 'Hot tub',
      description: 'З дровами',
      descriptionEn: 'Firewood included',
      priceMinor: 500000,
      unit: 'PER_STAY',
    });
    expect(addon.body).toMatchObject({ nameEn: 'Hot tub', descriptionEn: 'Firewood included', priceMinor: 500000 });
    expect((await post('/addons', { name: 'Мангал', priceMinor: 0 })).status).toBe(400);
  });
});

describe('included items', () => {
  const item = (name: string, nameEn: string, over: Record<string, unknown> = {}) => ({
    name,
    nameEn,
    icon: 'wifi',
    ...over,
  });

  it('CRUD, auto sort order; only active items are public, in order', async () => {
    const a = await post('/included', item('Прибирання', 'Cleaning', { icon: 'cleaning' }));
    const b = await post('/included', item('Інтернет', 'Internet'));
    const c = await post('/included', item('Парковка', 'Parking', { isActive: false }));
    expect([a.body.sortOrder, b.body.sortOrder, c.body.sortOrder]).toEqual([0, 1, 2]);
    expect((await post('/included', { name: 'Без англійської' })).status).toBe(400);

    const pub = (await call(srv, 'GET', '/pricing')).body;
    expect(pub.included.map((i: { name: string }) => i.name)).toEqual(['Прибирання', 'Інтернет']);

    const patched = await call(srv, 'PATCH', `/admin/pricing/included/${c.body.id}`, {
      token: owner,
      body: { isActive: true, sortOrder: -1 },
    });
    expect(patched.body).toMatchObject({ isActive: true, sortOrder: -1 });
    expect((await call(srv, 'GET', '/pricing')).body.included[0].name).toBe('Парковка');

    expect((await call(srv, 'DELETE', `/admin/pricing/included/${a.body.id}`, { token: owner })).status).toBe(200);
    const admin = (await call(srv, 'GET', '/admin/pricing', { token: owner })).body;
    expect(admin.included).toHaveLength(2);
  });

  it('is owner-only', async () => {
    const manager = (await createUser('MANAGER')).token;
    expect((await post('/included', item('Тест', 'Test'), manager)).status).toBe(403);
    expect((await post('/included', item('Тест', 'Test'), '')).status).toBe(401);
  });
});

describe('public /pricing', () => {
  it('returns active tariffs and extras with both language names; free extras stay visible', async () => {
    await prisma.priceRule.updateMany({ data: { name: 'Базовий', nameEn: 'Base' } });
    await prisma.addon.create({ data: { name: 'Мангал', nameEn: 'BBQ', priceMinor: 0 } });
    await prisma.addon.create({ data: { name: 'Прихований', nameEn: 'Hidden', priceMinor: 100, isActive: false } });
    const pub = (await call(srv, 'GET', '/pricing')).body;
    expect(pub.rules[0]).toMatchObject({ name: 'Базовий', nameEn: 'Base' });
    expect(pub.addons.map((a: { nameEn: string }) => a.nameEn)).toEqual(['BBQ']);
    expect(pub.addons[0].priceMinor).toBe(0);
  });
});

describe('DATES tariffs', () => {
  const base = { name: 'Різдво', nameEn: 'Christmas', kind: 'DATES', nightlyRateMinor: 300000 };

  it('stores a list of dates, rejects malformed lists, and exposes them publicly', async () => {
    const ok = await post('/rules', { ...base, dates: '2026-12-25,2026-12-26' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ kind: 'DATES', dates: '2026-12-25,2026-12-26' });

    for (const bad of ['25.12.2026', '2026-12-25,', '2026-12-25;2026-12-26', 'x']) {
      expect((await post('/rules', { ...base, dates: bad })).status).toBe(400);
    }

    const upd = await call(srv, 'PATCH', `/admin/pricing/rules/${ok.body.id}`, { token: owner, body: { dates: '2027-04-04' } });
    expect(upd.body.dates).toBe('2027-04-04');
    const pub = (await call(srv, 'GET', '/pricing')).body.rules.find((r: { kind: string }) => r.kind === 'DATES');
    expect(pub.dates).toBe('2027-04-04');
  });

  it('is used by the live quote for the listed night only', async () => {
    const { day } = await import('./helpers.js');
    await post('/rules', { ...base, dates: day(10), priority: 50 });
    const q = (a: number, b: number) =>
      call(srv, 'POST', '/quote', { body: { checkIn: day(a), checkOut: day(b), guestsCount: 2 } });
    expect((await q(10, 11)).body.accommodationMinor).toBe(300000); // the holiday night
    expect((await q(11, 12)).body.accommodationMinor).toBe(10000); // the next night: base rate
  });
});


import { describe, expect, it, vi } from 'vitest';
import { createRateProvider } from '../src/modules/fx/fx.service.js';

const nbu = (cc: string, rate: number, date = '04.11.2026') =>
  new Response(JSON.stringify([{ r030: 840, txt: 'x', rate, cc, exchangedate: date, special: 'N' }]), {
    status: 200,
  });

describe('NBU rate provider', () => {
  it('parses the NBU response into UAH-per-unit rates with an ISO date', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(nbu('USD', 45.666));
    const getRates = createRateProvider({ currencies: ['USD', 'USD'], fetchImpl });

    expect(await getRates()).toEqual({ source: 'NBU', date: '2026-11-04', uahPer: { UAH: 1, USD: 45.666 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1); // duplicates collapsed
    expect(fetchImpl.mock.calls[0]![0]).toContain('valcode=USD');
  });

  it('caches for an hour, then refreshes', async () => {
    let t = 0;
    const fetchImpl = vi.fn().mockResolvedValueOnce(nbu('USD', 45)).mockResolvedValueOnce(nbu('USD', 46));
    const getRates = createRateProvider({ currencies: ['USD'], fetchImpl, now: () => t });

    expect((await getRates())!.uahPer.USD).toBe(45);
    t += 30 * 60_000;
    expect((await getRates())!.uahPer.USD).toBe(45);
    t += 31 * 60_000;
    expect((await getRates())!.uahPer.USD).toBe(46);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the last known rate when NBU is down', async () => {
    let t = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(nbu('USD', 45))
      .mockResolvedValueOnce(new Response('oops', { status: 502 }))
      .mockRejectedValueOnce(new Error('timeout'));
    const getRates = createRateProvider({ currencies: ['USD'], fetchImpl, now: () => t });

    await getRates();
    t += 2 * 60 * 60_000;
    expect((await getRates())!.uahPer.USD).toBe(45);
    expect((await getRates())!.uahPer.USD).toBe(45);
  });

  it('returns null when no rate was ever fetched', async () => {
    const getRates = createRateProvider({ currencies: ['USD'], fetchImpl: vi.fn().mockRejectedValue(new Error('down')) });
    expect(await getRates()).toBeNull();
  });

  it('needs no network when the only currency is UAH', async () => {
    const fetchImpl = vi.fn();
    const getRates = createRateProvider({ currencies: ['UAH'], fetchImpl });
    expect((await getRates())!.uahPer).toEqual({ UAH: 1 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

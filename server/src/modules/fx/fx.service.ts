// Official exchange rates from the National Bank of Ukraine (NBU), used to show guests prices
// in their language's currency (UA → UAH, EN → USD). Prices themselves stay in the base
// currency (DEFAULT_CURRENCY); this is display-only.
//
// NBU API: GET https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&json
//   → [{ "cc": "USD", "rate": 45.666, "exchangedate": "04.11.2026", ... }]  (UAH per 1 unit)

const NBU_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
const TTL_MS = 60 * 60 * 1000; // NBU publishes once per business day; hourly refresh is plenty.

export interface ExchangeRates {
  source: 'NBU';
  date: string; // YYYY-MM-DD the NBU rate applies to
  // How many UAH one unit of each currency is worth. Always includes UAH (= 1).
  uahPer: Record<string, number>;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface NbuRow {
  cc: string;
  rate: number;
  exchangedate: string; // DD.MM.YYYY
}

async function fetchNbuRate(currency: string, fetchImpl: FetchLike) {
  const res = await fetchImpl(`${NBU_URL}?valcode=${encodeURIComponent(currency)}&json`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`NBU responded ${res.status}`);
  const rows = (await res.json()) as NbuRow[];
  const row = rows.find((r) => r.cc === currency);
  if (!row || !(row.rate > 0)) throw new Error(`NBU has no rate for ${currency}`);
  const [d, m, y] = row.exchangedate.split('.');
  return { rate: row.rate, date: `${y}-${m}-${d}` };
}

// Factory so tests can inject fetch and a clock; the app uses the default instance below.
export function createRateProvider(opts: {
  currencies: string[];
  fetchImpl?: FetchLike;
  now?: () => number;
}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const wanted = [...new Set(opts.currencies.filter((c) => c !== 'UAH'))];
  let cache: { value: ExchangeRates; at: number } | null = null;
  let inflight: Promise<ExchangeRates> | null = null;

  async function load(): Promise<ExchangeRates> {
    const results = await Promise.all(wanted.map((c) => fetchNbuRate(c, fetchImpl)));
    const uahPer: Record<string, number> = { UAH: 1 };
    wanted.forEach((c, i) => (uahPer[c] = results[i]!.rate));
    return { source: 'NBU', date: results[0]?.date ?? new Date(now()).toISOString().slice(0, 10), uahPer };
  }

  // Fresh cache → served as is. Stale/empty → refresh; if NBU is down, keep serving the last
  // known rate. Returns null only when we have never managed to fetch a rate.
  return async function getRates(): Promise<ExchangeRates | null> {
    if (cache && now() - cache.at < TTL_MS) return cache.value;
    inflight ??= load().finally(() => (inflight = null));
    try {
      const value = await inflight;
      cache = { value, at: now() };
      return value;
    } catch {
      return cache?.value ?? null;
    }
  };
}

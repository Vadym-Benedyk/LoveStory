// Date helpers for half-open stay ranges [checkIn, checkOut).
// All stay dates are calendar dates (no time component) to avoid TZ drift.

export const toDateOnly = (d: Date | string): Date => {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

export const addDays = (d: Date, days: number): Date => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
};

export const nightsBetween = (checkIn: Date, checkOut: Date): number =>
  Math.round((toDateOnly(checkOut).getTime() - toDateOnly(checkIn).getTime()) / 86_400_000);

// Half-open overlap test: [aStart, aEnd) intersects [bStart, bEnd)
export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  toDateOnly(aStart) < toDateOnly(bEnd) && toDateOnly(bStart) < toDateOnly(aEnd);

// Iterate each night (date) in [checkIn, checkOut)
export const eachNight = (checkIn: Date, checkOut: Date): Date[] => {
  const out: Date[] = [];
  let cur = toDateOnly(checkIn);
  const end = toDateOnly(checkOut);
  while (cur < end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
};

export const isWeekend = (d: Date, weekendDays: number[] = [5, 6]): boolean =>
  weekendDays.includes(d.getUTCDay());

// Availability = CONFIRMED bookings + manual CalendarBlocks. PENDING never blocks.
import { prisma } from '../../lib/prisma.js';
import { rangesOverlap, toDateOnly } from '../../lib/dates.js';

export interface UnavailableRange {
  start: string; // inclusive (YYYY-MM-DD)
  end: string; // exclusive
  kind: 'BOOKING' | 'BLOCK';
}

// Ranges that block public availability within [from, to).
export async function getUnavailableRanges(from: Date, to: Date): Promise<UnavailableRange[]> {
  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        checkIn: { lt: toDateOnly(to) },
        checkOut: { gt: toDateOnly(from) },
      },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.calendarBlock.findMany({
      where: { startDate: { lt: toDateOnly(to) }, endDate: { gt: toDateOnly(from) } },
      select: { startDate: true, endDate: true },
    }),
  ]);

  return [
    ...bookings.map((b) => ({
      start: b.checkIn.toISOString().slice(0, 10),
      end: b.checkOut.toISOString().slice(0, 10),
      kind: 'BOOKING' as const,
    })),
    ...blocks.map((b) => ({
      start: b.startDate.toISOString().slice(0, 10),
      end: b.endDate.toISOString().slice(0, 10),
      kind: 'BLOCK' as const,
    })),
  ];
}

// Authoritative check used at request-submit and confirm time.
export async function isRangeAvailable(
  checkIn: Date,
  checkOut: Date,
  opts: { tx?: typeof prisma } = {},
): Promise<boolean> {
  const db = opts.tx ?? prisma;
  const confirmed = await db.booking.findFirst({
    where: {
      status: 'CONFIRMED',
      checkIn: { lt: toDateOnly(checkOut) },
      checkOut: { gt: toDateOnly(checkIn) },
    },
    select: { id: true },
  });
  if (confirmed) return false;

  const block = await db.calendarBlock.findFirst({
    where: { startDate: { lt: toDateOnly(checkOut) }, endDate: { gt: toDateOnly(checkIn) } },
    select: { id: true },
  });
  return !block;
}

// Pending requests that overlap a given range (advisory — shown to admin, not blocking).
export async function getOverlappingPending(checkIn: Date, checkOut: Date, excludeId?: string) {
  const pendings = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      checkIn: { lt: toDateOnly(checkOut) },
      checkOut: { gt: toDateOnly(checkIn) },
    },
  });
  return pendings.filter((p) => rangesOverlap(p.checkIn, p.checkOut, checkIn, checkOut));
}

import { prisma } from '../../lib/prisma.js';
import { BadRequest, NotFound } from '../../lib/errors.js';
import { toDateOnly } from '../../lib/dates.js';

// Admin calendar view: confirmed bookings (block dates), pending requests (advisory overlay),
// and manual blocks — all within [from, to).
export async function getAdminCalendar(from: Date, to: Date) {
  const lo = toDateOnly(from);
  const hi = toDateOnly(to);

  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PENDING'] },
        checkIn: { lt: hi },
        checkOut: { gt: lo },
      },
      select: {
        id: true,
        reference: true,
        guestName: true,
        guestPhone: true,
        status: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: 'asc' },
    }),
    prisma.calendarBlock.findMany({
      where: { startDate: { lt: hi }, endDate: { gt: lo } },
      orderBy: { startDate: 'asc' },
    }),
  ]);

  return {
    confirmed: bookings.filter((b) => b.status === 'CONFIRMED'),
    pending: bookings.filter((b) => b.status === 'PENDING'),
    blocks,
  };
}

export async function createBlock(
  input: { startDate: string; endDate: string; reason?: string },
  actorId: string,
) {
  const start = toDateOnly(input.startDate);
  const end = toDateOnly(input.endDate);
  if (end <= start) throw BadRequest('End date must be after start date');

  const block = await prisma.calendarBlock.create({
    data: { startDate: start, endDate: end, reason: input.reason, createdById: actorId },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'BLOCK_CREATED', entity: 'CalendarBlock', entityId: block.id },
  });
  return block;
}

export async function deleteBlock(id: string, actorId: string) {
  const existing = await prisma.calendarBlock.findUnique({ where: { id } });
  if (!existing) throw NotFound('Block not found');
  await prisma.calendarBlock.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId, action: 'BLOCK_DELETED', entity: 'CalendarBlock', entityId: id },
  });
  return { ok: true };
}

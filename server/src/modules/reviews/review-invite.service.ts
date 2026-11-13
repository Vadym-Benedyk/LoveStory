// Review invitations: a guest may leave a review only through a one-off link tied to their stay.
//
// - After check-out, the hourly job (jobs/review-invite.job.ts) creates a token for each CONFIRMED
//   booking that has none and sends the link: by email to the guest when they left an address and
//   SMTP is configured, otherwise to the owner (Telegram / email) to forward by hand. The admin can
//   also (re)send it from the booking panel.
// - The guest opens /review/<token> on the site: GET shows the stay, POST creates the review as
//   PENDING with bookingId set, which is what "verified stay" means on the public site.
// - One review per booking; the link expires INVITE_TTL_DAYS after it was created.
import { randomBytes } from 'node:crypto';
import { AppError, Conflict, NotFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import {
  canEmailGuests,
  emailGuest,
  notifyNewReview,
  notifyOwner,
  publicUrl,
} from '../../lib/notify.js';
import {
  formatReviewInviteForOwnerMessage,
  formatReviewInviteMessage,
  type ReviewInviteNotice,
} from '../../lib/notify-channels.js';
import { prisma } from '../../lib/prisma.js';

export const INVITE_TTL_DAYS = 60;
// The job invites once the check-out day is well under way (check-out is at noon), and only for
// recent stays, so a manual entry of an old booking does not trigger a letter months later.
const INVITE_AFTER_CHECKOUT_MS = 12 * 3_600_000;
const INVITE_MAX_AGE_DAYS = 14;

export type InviteChannel = 'EMAIL' | 'TELEGRAM' | 'MANUAL';

export const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] || fullName.trim();

export const inviteLink = (token: string): string => publicUrl(`/review/${token}`);

const expiresAt = (invitedAt: Date): Date => new Date(invitedAt.getTime() + INVITE_TTL_DAYS * 86_400_000);

// "YYYY-MM" of the check-in, so the client can show the month in the visitor's language.
const stayMonthOf = (checkIn: Date): string =>
  `${checkIn.getUTCFullYear()}-${String(checkIn.getUTCMonth() + 1).padStart(2, '0')}`;

async function propertyName(): Promise<string> {
  const s = await prisma.siteSettings
    .findUnique({ where: { id: 'default' }, select: { propertyName: true } })
    .catch(() => null);
  return s?.propertyName || 'LoveStory';
}

// Creates the token if the booking has none, then delivers the link. Returns how it went out.
// `force` re-sends an existing invitation (admin button); the token stays the same so an earlier
// letter keeps working.
export async function sendInvite(
  bookingId: string,
  opts: { force?: boolean } = {},
): Promise<{ token: string; channel: InviteChannel; link: string; invitedAt: Date }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { review: { select: { id: true } } },
  });
  if (!booking) throw NotFound('Booking not found');
  if (booking.status !== 'CONFIRMED') throw Conflict(`Cannot invite a review for a ${booking.status} booking`);
  if (booking.review) throw Conflict('This booking already has a review');
  if (booking.reviewInviteToken && booking.reviewInvitedAt && !opts.force) {
    return {
      token: booking.reviewInviteToken,
      channel: (booking.reviewInviteChannel as InviteChannel | null) ?? 'MANUAL',
      link: inviteLink(booking.reviewInviteToken),
      invitedAt: booking.reviewInvitedAt,
    };
  }

  const token = booking.reviewInviteToken ?? randomBytes(24).toString('base64url');
  // A re-send restarts the 60 days, otherwise a late re-send could hand out a link about to expire.
  const invitedAt = new Date();
  const link = inviteLink(token);
  const notice: ReviewInviteNotice = {
    reference: booking.reference,
    guestName: booking.guestName,
    guestFirstName: firstName(booking.guestName),
    propertyName: await propertyName(),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    link,
  };

  let channel: InviteChannel = 'MANUAL';
  if (booking.guestEmail && canEmailGuests()) {
    if (await emailGuest(booking.reference, booking.guestEmail, formatReviewInviteMessage(notice))) {
      channel = 'EMAIL';
    }
  }
  if (channel === 'MANUAL') {
    // No guest email (or it did not go out): hand the link to the owner to forward.
    if (await notifyOwner(booking.reference, formatReviewInviteForOwnerMessage(notice))) channel = 'TELEGRAM';
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { reviewInviteToken: token, reviewInvitedAt: invitedAt, reviewInviteChannel: channel },
  });
  logger.info({ reference: booking.reference, channel }, 'Review invitation sent');
  return { token, channel, link, invitedAt };
}

// Hourly: invite the guests whose stay has just ended. Returns the number of invitations made.
export async function inviteRecentCheckouts(now = new Date()): Promise<number> {
  const due = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reviewInviteToken: null,
      review: null,
      checkOut: {
        lte: new Date(now.getTime() - INVITE_AFTER_CHECKOUT_MS),
        gte: new Date(now.getTime() - INVITE_MAX_AGE_DAYS * 86_400_000),
      },
    },
    select: { id: true, reference: true },
    orderBy: { checkOut: 'asc' },
  });
  let count = 0;
  for (const b of due) {
    try {
      await sendInvite(b.id);
      count++;
    } catch (err) {
      logger.error({ err, reference: b.reference }, 'Review invitation failed');
    }
  }
  return count;
}

export type InviteState = 'OPEN' | 'USED' | 'EXPIRED';

export interface InviteView {
  state: InviteState;
  propertyName: string;
  guestFirstName: string;
  checkIn: Date;
  checkOut: Date;
}

async function findByToken(token: string) {
  const booking = await prisma.booking.findUnique({
    where: { reviewInviteToken: token },
    include: { review: { select: { id: true } } },
  });
  if (!booking || !booking.reviewInvitedAt) throw NotFound('Invitation not found');
  const state: InviteState = booking.review
    ? 'USED'
    : expiresAt(booking.reviewInvitedAt) < new Date()
      ? 'EXPIRED'
      : 'OPEN';
  return { booking, state };
}

// What the review page shows before the form. Never includes the guest's contacts.
export async function getInvite(token: string): Promise<InviteView> {
  const { booking, state } = await findByToken(token);
  return {
    state,
    propertyName: await propertyName(),
    guestFirstName: firstName(booking.guestName),
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
  };
}

export interface InvitedReviewInput {
  authorName?: string; // defaults to the guest's first name; only a name, never contacts
  rating: number;
  title?: string;
  body: string;
}

export async function submitInvitedReview(token: string, input: InvitedReviewInput) {
  const { booking, state } = await findByToken(token);
  if (state === 'USED') throw Conflict('A review for this stay has already been submitted');
  if (state === 'EXPIRED') throw new AppError(410, 'This invitation has expired', 'INVITE_EXPIRED');

  const authorName = input.authorName?.trim() || firstName(booking.guestName);
  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      authorName,
      rating: input.rating,
      title: input.title?.trim() || null,
      body: input.body.trim(),
      stayMonth: stayMonthOf(booking.checkIn),
      status: 'PENDING',
      source: 'WEBSITE',
    },
  });
  await notifyNewReview({
    reference: booking.reference,
    authorName,
    rating: review.rating,
    title: review.title,
    body: review.body,
    adminUrl: publicUrl('/admin/reviews'),
  });
  return review;
}

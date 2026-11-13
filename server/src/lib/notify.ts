// Notifications (T8.1): owner alerts and guest letters.
// Channels: email (SMTP_URL) and Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID), each optional.
// Every event is always logged, so the owner has a fallback even with no channel configured;
// the admin inbox stays the source of truth either way.
import { createTransport } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import {
  formatNewRequestMessage,
  formatNewReviewMessage,
  sendEmail,
  sendTelegram,
  withRetry,
  type MailSender,
  type NewRequestNotice,
  type NewReviewNotice,
  type NotificationMessage,
} from './notify-channels.js';

export type { NewRequestNotice, NewReviewNotice } from './notify-channels.js';

let mailer: MailSender | null = null;
function getMailer(): MailSender | null {
  if (!env.SMTP_URL) return null;
  mailer ??= createTransport(env.SMTP_URL);
  return mailer;
}

// Admin-editable address (Settings) wins over the env default.
// With "same as the site email" on, the public contact email is the recipient.
export async function resolveRecipientEmail(): Promise<string | undefined> {
  const settings = await prisma.siteSettings
    .findUnique({ where: { id: 'default' }, select: { notificationEmail: true, notifyToSiteEmail: true, email: true } })
    .catch(() => null);
  const own = settings?.notifyToSiteEmail ? settings.email : settings?.notificationEmail;
  return own || env.NOTIFY_EMAIL || undefined;
}

// The canonical site origin (first CLIENT_ORIGIN entry) + a path.
export function publicUrl(path: string): string {
  const origin = env.CLIENT_ORIGIN.split(',')[0]!.trim().replace(/\/$/, '');
  return `${origin}${path}`;
}

export function adminRequestsUrl(): string {
  return publicUrl('/admin/requests');
}

export const canEmailGuests = (): boolean => Boolean(env.SMTP_URL);
export const canTelegramOwner = (): boolean => Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);

type Job = { channel: string; run: () => Promise<void> };

// Runs the channel jobs with retries and logs each outcome. Never throws.
async function dispatch(ref: string, what: string, jobs: Job[]): Promise<boolean> {
  if (jobs.length === 0) {
    logger.warn({ ref }, `${what}: no notification channel configured (SMTP_URL / TELEGRAM_*)`);
    return false;
  }
  const results = await Promise.allSettled(jobs.map((j) => withRetry(j.run)));
  let ok = false;
  results.forEach((r, i) => {
    const channel = jobs[i]!.channel;
    if (r.status === 'fulfilled') {
      ok = true;
      logger.info({ ref, channel }, `${what}: sent`);
    } else {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      logger.error({ ref, channel, err: reason }, `${what}: failed`);
    }
  });
  return ok;
}

// Owner channels: email to the notification address and/or Telegram.
async function ownerJobs(msg: NotificationMessage, replyTo?: string | null): Promise<Job[]> {
  const jobs: Job[] = [];
  const transport = getMailer();
  const to = transport ? await resolveRecipientEmail() : undefined;
  if (transport && to) {
    jobs.push({
      channel: 'email',
      run: () => sendEmail(transport, { from: env.NOTIFY_FROM || to, to, replyTo }, msg),
    });
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const cfg = { botToken: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID };
    jobs.push({ channel: 'telegram', run: () => sendTelegram(cfg, msg) });
  }
  return jobs;
}

// Never throws: a failed notification must not fail the guest's booking request.
export async function notifyNewRequest(notice: NewRequestNotice): Promise<void> {
  logger.info({ reference: notice.reference }, 'New booking request');
  const msg = formatNewRequestMessage(notice);
  await dispatch(notice.reference, 'Owner notification', await ownerJobs(msg, notice.guestEmail));
}

// Any owner-facing message (review invitation to forward, new review). Resolves to whether at least
// one channel delivered it.
export async function notifyOwner(ref: string, msg: NotificationMessage): Promise<boolean> {
  return dispatch(ref, 'Owner notification', await ownerJobs(msg));
}

export async function notifyNewReview(notice: NewReviewNotice): Promise<void> {
  logger.info({ reference: notice.reference ?? null, rating: notice.rating }, 'New review');
  await notifyOwner(notice.reference ?? 'review', formatNewReviewMessage(notice));
}

// Where a guest's reply to one of our letters should land. The sender address (SES: info@<domain>) may
// have no mailbox behind it, so replies go to the contact email shown on the site, then to the owner's
// notification address.
export async function resolveGuestReplyTo(): Promise<string | undefined> {
  const settings = await prisma.siteSettings
    .findUnique({ where: { id: 'default' }, select: { email: true } })
    .catch(() => null);
  return settings?.email.trim() || (await resolveRecipientEmail());
}

// A letter to a guest (review invitation). False when email is not configured or sending failed.
export async function emailGuest(ref: string, to: string, msg: NotificationMessage): Promise<boolean> {
  const transport = getMailer();
  if (!transport) return false;
  const from = env.NOTIFY_FROM || (await resolveRecipientEmail());
  if (!from) {
    logger.warn({ ref }, 'Guest email: no sender address (NOTIFY_FROM / NOTIFY_EMAIL)');
    return false;
  }
  const replyTo = (await resolveGuestReplyTo()) ?? from;
  return dispatch(ref, 'Guest email', [
    { channel: 'email', run: () => sendEmail(transport, { from, to, replyTo }, msg) },
  ]);
}

// Owner notifications for new booking requests (T8.1).
// Channels: email (SMTP_URL) and Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID), each optional.
// Every request is always logged, so the owner has a fallback even with no channel configured;
// the admin Requests inbox stays the source of truth either way.
import { createTransport } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';
import {
  formatNewRequestMessage,
  sendEmail,
  sendTelegram,
  withRetry,
  type MailSender,
  type NewRequestNotice,
} from './notify-channels.js';

export type { NewRequestNotice } from './notify-channels.js';

let mailer: MailSender | null = null;
function getMailer(): MailSender | null {
  if (!env.SMTP_URL) return null;
  mailer ??= createTransport(env.SMTP_URL);
  return mailer;
}

// Admin-editable address (Settings) wins over the env default.
async function resolveRecipientEmail(): Promise<string | undefined> {
  const settings = await prisma.siteSettings
    .findUnique({ where: { id: 'default' }, select: { notificationEmail: true } })
    .catch(() => null);
  return settings?.notificationEmail || env.NOTIFY_EMAIL || undefined;
}

export function adminRequestsUrl(): string {
  const origin = env.CLIENT_ORIGIN.split(',')[0]!.trim().replace(/\/$/, '');
  return `${origin}/admin/requests`;
}

// Never throws: a failed notification must not fail the guest's booking request.
export async function notifyNewRequest(notice: NewRequestNotice): Promise<void> {
  logger.info({ reference: notice.reference }, 'New booking request');
  const msg = formatNewRequestMessage(notice);

  const jobs: { channel: string; run: () => Promise<void> }[] = [];

  const transport = getMailer();
  const to = transport ? await resolveRecipientEmail() : undefined;
  if (transport && to) {
    jobs.push({
      channel: 'email',
      run: () =>
        sendEmail(transport, { from: env.NOTIFY_FROM || to, to, replyTo: notice.guestEmail }, msg),
    });
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const cfg = { botToken: env.TELEGRAM_BOT_TOKEN, chatId: env.TELEGRAM_CHAT_ID };
    jobs.push({ channel: 'telegram', run: () => sendTelegram(cfg, msg) });
  }

  if (jobs.length === 0) {
    logger.warn(
      { reference: notice.reference },
      'No notification channel configured (SMTP_URL / TELEGRAM_*) — owner will only see this in the admin inbox',
    );
    return;
  }

  const results = await Promise.allSettled(jobs.map((j) => withRetry(j.run)));
  results.forEach((r, i) => {
    const channel = jobs[i]!.channel;
    if (r.status === 'fulfilled') {
      logger.info({ reference: notice.reference, channel }, 'Owner notified');
    } else {
      const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
      logger.error({ reference: notice.reference, channel, err: reason }, 'Owner notification failed');
    }
  });
}

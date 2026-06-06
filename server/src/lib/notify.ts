// Notification dispatch. MVP logs + optional email/Telegram; wired in T8.1.
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface NewRequestNotice {
  reference: string;
  guestName: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
}

export async function notifyNewRequest(notice: NewRequestNotice): Promise<void> {
  // Always log so the owner has a fallback even if channels fail.
  logger.info({ notice }, 'New booking request');

  // TODO(T8.1): send transactional email via SMTP_URL and/or Telegram.
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    // placeholder for Telegram sendMessage
  }
  if (env.SMTP_URL && env.NOTIFY_EMAIL) {
    // placeholder for email send
  }
}

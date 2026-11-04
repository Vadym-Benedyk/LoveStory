// Pure notification building blocks: message formatting, retry, and channel senders.
// No env / DB access here, so everything is unit-testable (see tests/notify-channels.test.ts).
// The dispatcher that wires these to config lives in notify.ts.

export interface NewRequestNotice {
  reference: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string | null;
  guestsCount: number;
  capacity?: number | null; // house capacity, to flag over-capacity requests
  checkIn: Date; // date-only (UTC midnight)
  checkOut: Date; // exclusive
  nights: number;
  totalMinor: number;
  currency: string;
  addons: { name: string; quantity: number }[];
  comments?: string | null;
  adminUrl?: string;
}

export interface NotificationMessage {
  subject: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Formatting (owner-facing, Ukrainian — the owner's working language)
// ---------------------------------------------------------------------------

const fmtDate = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

export const fmtMoney = (minor: number, currency: string): string =>
  new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(minor / 100);

// Ukrainian plural for "night": 1 ніч, 2–4 ночі, 5+ ночей (11–14 → ночей).
export function nightsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ніч`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ночі`;
  return `${n} ночей`;
}

export function formatNewRequestMessage(n: NewRequestNotice): NotificationMessage {
  const lines = [
    `🛎 Нова заявка на бронювання — ${n.reference}`,
    '',
    `Гість: ${n.guestName}`,
    `Телефон: ${n.guestPhone}`,
    n.guestEmail ? `Email: ${n.guestEmail}` : null,
    `Дати: ${fmtDate(n.checkIn)} → ${fmtDate(n.checkOut)} (${nightsLabel(n.nights)})`,
    n.capacity && n.guestsCount > n.capacity
      ? `Гостей: ${n.guestsCount} ⚠️ більше за місткість (${n.capacity}) — уточніть під час дзвінка`
      : `Гостей: ${n.guestsCount}`,
    `Сума (орієнтовно): ${fmtMoney(n.totalMinor, n.currency)}`,
    n.addons.length
      ? `Додатково: ${n.addons.map((a) => `${a.name} ×${a.quantity}`).join(', ')}`
      : null,
    n.comments ? `Коментар: ${n.comments}` : null,
    '',
    'Нічого не заброньовано, доки ви не підтвердите заявку після дзвінка гостю.',
    n.adminUrl ? `Заявки: ${n.adminUrl}` : null,
  ].filter((l): l is string => l !== null);

  return {
    subject: `Нова заявка ${n.reference}: ${fmtDate(n.checkIn)}–${fmtDate(n.checkOut)}, ${n.guestName}`,
    text: lines.join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------

export async function withRetry<T>(
  fn: () => Promise<T>,
  delaysMs: number[] = [1_000, 5_000],
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = delaysMs[attempt];
      if (delay === undefined) break;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function sendTelegram(
  cfg: { botToken: string; chatId: string },
  msg: NotificationMessage,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  const res = await fetchImpl(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Plain text (no parse_mode) so guest-supplied text never needs escaping.
    body: JSON.stringify({ chat_id: cfg.chatId, text: msg.text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Never include the URL (it contains the bot token) in the error.
    const body = (await res.json().catch(() => null)) as { description?: string } | null;
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body?.description ?? ''}`.trim());
  }
}

// Minimal slice of a nodemailer Transporter, so tests can pass a fake.
export interface MailSender {
  sendMail(opts: {
    from: string;
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
}

export async function sendEmail(
  transport: MailSender,
  cfg: { from: string; to: string; replyTo?: string | null },
  msg: NotificationMessage,
): Promise<void> {
  await transport.sendMail({
    from: cfg.from,
    to: cfg.to,
    replyTo: cfg.replyTo ?? undefined,
    subject: msg.subject,
    text: msg.text,
  });
}

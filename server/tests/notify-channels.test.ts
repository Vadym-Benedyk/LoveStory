import { describe, it, expect, vi } from 'vitest';
import {
  fmtMoney,
  formatNewRequestMessage,
  nightsLabel,
  sendEmail,
  sendTelegram,
  withRetry,
  type MailSender,
  type NewRequestNotice,
} from '../src/lib/notify-channels.js';

const notice = (over: Partial<NewRequestNotice> = {}): NewRequestNotice => ({
  reference: 'ABCD2345',
  guestName: 'Олена Коваль',
  guestPhone: '+380501234567',
  guestEmail: 'olena@example.com',
  guestsCount: 2,
  checkIn: new Date(Date.UTC(2026, 10, 12)),
  checkOut: new Date(Date.UTC(2026, 10, 14)),
  nights: 2,
  totalMinor: 400000,
  currency: 'UAH',
  addons: [],
  comments: null,
  adminUrl: 'http://localhost:5173/admin/requests',
  ...over,
});

describe('nightsLabel (Ukrainian plural)', () => {
  it.each([
    [1, '1 ніч'],
    [2, '2 ночі'],
    [4, '4 ночі'],
    [5, '5 ночей'],
    [11, '11 ночей'],
    [12, '12 ночей'],
    [21, '21 ніч'],
    [22, '22 ночі'],
  ])('%i → %s', (n, expected) => expect(nightsLabel(n)).toBe(expected));
});

describe('formatNewRequestMessage', () => {
  it('includes the key facts the owner needs to call the guest', () => {
    const { subject, text } = formatNewRequestMessage(notice());
    expect(subject).toBe('Нова заявка ABCD2345: 12.11.2026–14.11.2026, Олена Коваль');
    expect(text).toContain('Телефон: +380501234567');
    expect(text).toContain('Email: olena@example.com');
    expect(text).toContain('Дати: 12.11.2026 → 14.11.2026 (2 ночі)');
    expect(text).toContain(`Сума (орієнтовно): ${fmtMoney(400000, 'UAH')}`);
    expect(text).toContain('Заявки: http://localhost:5173/admin/requests');
  });

  it('omits empty optional lines and lists add-ons / comments when present', () => {
    const bare = formatNewRequestMessage(notice({ guestEmail: null })).text;
    expect(bare).not.toContain('Email:');
    expect(bare).not.toContain('Додатково:');
    expect(bare).not.toContain('Коментар:');

    const full = formatNewRequestMessage(
      notice({ addons: [{ name: 'Баня', quantity: 1 }, { name: 'Дрова', quantity: 2 }], comments: 'Приїдемо пізно' }),
    ).text;
    expect(full).toContain('Додатково: Баня ×1, Дрова ×2');
    expect(full).toContain('Коментар: Приїдемо пізно');
  });
});

describe('withRetry', () => {
  it('retries until success', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValue('ok');
    await expect(withRetry(fn, [0, 0])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after all attempts and rethrows the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'));
    await expect(withRetry(fn, [0, 0])).rejects.toThrow('down');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('sendTelegram', () => {
  const msg = { subject: 's', text: 'hello' };

  it('posts plain text to the bot API', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    await sendTelegram({ botToken: 'T0K', chatId: '42' }, msg, fetchImpl);

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.telegram.org/botT0K/sendMessage');
    expect(JSON.parse(init.body)).toEqual({ chat_id: '42', text: 'hello', disable_web_page_preview: true });
  });

  it('throws with Telegram description but without leaking the token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{"ok":false,"description":"chat not found"}', { status: 400 }));
    const err = await sendTelegram({ botToken: 'SECRET', chatId: '1' }, msg, fetchImpl).catch((e) => e);
    expect(err.message).toContain('chat not found');
    expect(err.message).not.toContain('SECRET');
  });
});

describe('sendEmail', () => {
  it('sets reply-to to the guest so the owner can answer directly', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    const transport: MailSender = { sendMail };
    await sendEmail(transport, { from: 'a@x.com', to: 'b@x.com', replyTo: 'g@x.com' }, { subject: 'S', text: 'T' });
    expect(sendMail).toHaveBeenCalledWith({ from: 'a@x.com', to: 'b@x.com', replyTo: 'g@x.com', subject: 'S', text: 'T' });
  });
});

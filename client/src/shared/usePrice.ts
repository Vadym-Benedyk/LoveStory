// Guest-facing prices in the language's currency: Ukrainian → hryvnia ("грн"), English → US
// dollars. Amounts are stored in the base currency (minor units) and converted at the official
// NBU rate. Without a rate, the original currency is shown rather than a made-up number.
import { useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Lang } from '@/i18n/translations';
import { useExchangeRates, type ExchangeRates } from '@/shared/api/queries';

export const DISPLAY_CURRENCY: Record<Lang, string> = { uk: 'UAH', en: 'USD' };

function convert(amount: number, from: string, to: string, rates?: ExchangeRates) {
  if (from === to) return { amount, currency: to, converted: false };
  const fromUah = rates?.uahPer[from];
  const toUah = rates?.uahPer[to];
  if (!fromUah || !toUah) return { amount, currency: from, converted: false };
  return { amount: (amount * fromUah) / toUah, currency: to, converted: true };
}

function formatAmount(amount: number, currency: string, lang: Lang, uahLabel: string) {
  const locale = lang === 'uk' ? 'uk-UA' : 'en';
  if (currency === 'UAH') {
    // Whole hryvnias, "грн" suffix (Intl would print "₴").
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(amount))} ${uahLabel}`;
  }
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol', // "$" in both languages (uk-UA would print "USD")
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}

export function usePrice() {
  const { lang, t } = useLanguage();
  const { data: rates } = useExchangeRates();
  const target = DISPLAY_CURRENCY[lang];
  const uahLabel = t('currency.uah');

  // `minor` is in minor units (cents/kopiyky) of `currency`.
  const format = useCallback(
    (minor: number, currency: string) => {
      const c = convert(minor / 100, currency, target, rates);
      return formatAmount(c.amount, c.currency, lang, uahLabel);
    },
    [lang, rates, target, uahLabel],
  );

  // "За курсом НБУ на 04.11.2026: 1 $ = 45,67 грн" — only when a conversion actually happens.
  const rateNote = useCallback(
    (currency: string) => {
      const c = convert(1, currency, target, rates);
      if (!c.converted || !rates) return null;
      const [y, m, d] = rates.date.split('-');
      const one = formatAmount(1, currency, lang, uahLabel);
      const per = new Intl.NumberFormat(lang === 'uk' ? 'uk-UA' : 'en', { maximumFractionDigits: 2 }).format(c.amount);
      const unit = target === 'UAH' ? uahLabel : target;
      return t('price.rateNote', { date: `${d}.${m}.${y}`, one, rate: `${per} ${unit}` });
    },
    [lang, rates, t, target, uahLabel],
  );

  return { format, rateNote };
}

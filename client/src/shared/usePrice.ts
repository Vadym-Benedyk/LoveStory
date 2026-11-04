// All prices are in hryvnias (stored as minor units = kopiyky). Shown as whole hryvnias:
// Ukrainian "3 500 грн", English "3,500 UAH". No currency conversion anywhere.
import { useCallback } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import type { Lang } from '@/i18n/translations';

export function formatUah(minor: number, lang: Lang, label: string): string {
  const locale = lang === 'uk' ? 'uk-UA' : 'en';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(minor / 100))} ${label}`;
}

export function usePrice() {
  const { lang, t } = useLanguage();
  const label = t('currency.uah'); // "грн" / "UAH"
  const format = useCallback((minor: number) => formatUah(minor, lang, label), [lang, label]);
  return { format, currencyLabel: label };
}

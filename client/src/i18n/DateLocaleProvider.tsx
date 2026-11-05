// Date localization that follows the site language: MUI date pickers/calendars (month names,
// weekday labels, Monday-first weeks, field format DD.MM.YYYY vs MM/DD/YYYY, aria texts) and
// dayjs formatting. One provider for the whole app — pickers must not add their own.
import { useCallback, type ReactNode } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/uk';
import 'dayjs/locale/en';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { enUS, ukUA } from '@mui/x-date-pickers/locales';
import { useLanguage } from './LanguageContext';
import type { Lang } from './translations';

const PICKER_TEXT = {
  uk: {
    ...ukUA.components.MuiLocalizationProvider.defaultProps.localeText,
    // MUI's Ukrainian pack keeps Latin field placeholders ("DD.MM.YYYY").
    fieldDayPlaceholder: () => 'ДД',
    fieldMonthPlaceholder: () => 'ММ',
    fieldYearPlaceholder: (params: { digitAmount: number }) => 'Р'.repeat(params.digitAmount),
  },
  en: enUS.components.MuiLocalizationProvider.defaultProps.localeText,
} as const;

export function DateLocaleProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage();
  dayjs.locale(lang); // global dayjs locale for any dayjs().format(...) in the app
  return (
    // No `key={lang}`: remounting would wipe every form on the page when the language changes.
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={lang} localeText={PICKER_TEXT[lang]}>
      {children}
    </LocalizationProvider>
  );
}

// "20.11.2026" (UA) / "Nov 20, 2026" (EN). Accepts ISO strings from the API or dayjs values.
// Stay dates are calendar dates: take the YYYY-MM-DD part so no timezone can shift the day.
export function formatDate(value: string | dayjs.Dayjs, lang: Lang): string {
  const d = typeof value === 'string' ? dayjs(value.slice(0, 10)) : value;
  return d.locale(lang).format(lang === 'uk' ? 'DD.MM.YYYY' : 'MMM D, YYYY');
}

// Moment something happened (a real timestamp, unlike stay dates), shown in the viewer's own
// timezone: "05.11.2026, 14:32" (UA) / "Nov 5, 2026, 2:32 PM" (EN).
export function formatDateTime(value: string, lang: Lang): string {
  return dayjs(value).locale(lang).format(lang === 'uk' ? 'DD.MM.YYYY, HH:mm' : 'MMM D, YYYY, h:mm A');
}

export function useFormatDateTime() {
  const { lang } = useLanguage();
  return useCallback((value: string) => formatDateTime(value, lang), [lang]);
}

export function useFormatDate() {
  const { lang } = useLanguage();
  return useCallback((value: string | dayjs.Dayjs) => formatDate(value, lang), [lang]);
}

// i18n registry. Per-language dictionaries live in ./locales/*.
// Ukrainian is the default; English is the alternate.
import { uk } from './locales/uk';
import { en } from './locales/en';

export type Lang = 'uk' | 'en';

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'uk', label: 'Українська', short: 'UA' },
  { code: 'en', label: 'English', short: 'EN' },
];

export const DEFAULT_LANG: Lang = 'uk';

export type Dict = Record<string, string>;

export const translations: Record<Lang, Dict> = { uk, en };

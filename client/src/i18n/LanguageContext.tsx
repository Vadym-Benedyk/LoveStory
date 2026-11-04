import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_LANG, translations, type Lang } from './translations';

interface LanguageState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tp: (key: string, n: number, vars?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'lovestory_lang';
const LanguageContext = createContext<LanguageState | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function initialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'uk' || saved === 'en' ? saved : DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      interpolate(translations[lang][key] ?? translations.en[key] ?? key, vars),
    [lang],
  );

  // Plurals: looks up `${key}.${category}` (Intl.PluralRules: uk → one/few/many/other,
  // en → one/other) and interpolates {n}. Falls back to `${key}.other`.
  const tp = useCallback(
    (key: string, n: number, vars?: Record<string, string | number>) => {
      const cat = new Intl.PluralRules(lang).select(n);
      const dict = translations[lang];
      const str =
        dict[`${key}.${cat}`] ?? dict[`${key}.other`] ?? translations.en[`${key}.other`] ?? key;
      return interpolate(str, { n, ...vars });
    },
    [lang],
  );

  const value = useMemo<LanguageState>(
    () => ({ lang, setLang: setLangState, t, tp }),
    [lang, t, tp],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

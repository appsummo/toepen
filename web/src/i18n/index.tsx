import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { nl, type TranslationKey, type Translations } from './nl.js';
import { en } from './en.js';
import type { LogEntry } from '../types.js';

export type Lang = 'nl' | 'en';

export const LANGS: Lang[] = ['nl', 'en'];

const TABLES: Record<Lang, Translations> = { nl, en };
const LOCALES: Record<Lang, string> = { nl: 'nl-NL', en: 'en-GB' };

const STORAGE_KEY = 'toepen:lang';

/** A player's own choice wins; otherwise follow the browser, Dutch or not. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'nl' || saved === 'en') return saved;
  } catch {
    // Private mode or blocked storage: fall through to the browser's languages.
  }
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  return prefs.some((l) => l?.toLowerCase().startsWith('nl')) ? 'nl' : 'en';
}

export type Params = Record<string, string | number>;

/** Replace `{name}` with `params.name`; an unknown placeholder is left alone. */
function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  );
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The string for `key`, with any `{placeholders}` filled in. */
  t: (key: TranslationKey, params?: Params) => string;
  /**
   * Like `t`, for a key assembled at runtime from server data. An unknown key
   * yields `fallback` rather than an empty gap in the page.
   */
  tOr: (key: string, fallback: string, params?: Params) => string;
  /** Singular/plural pair: `base.one` or `base.other`, with `{n}` filled in. */
  tn: (base: 'table.stake', n: number, params?: Params) => string;
  /** One line of the round log, rendered from the server's structured entry. */
  logLine: (entry: LogEntry) => string;
  /** A server error: by code when we know it, else whatever the server said. */
  errorText: (code?: string | null, fallback?: string | null) => string;
  /** BCP 47 tag for `Intl` / `toLocaleTimeString`. */
  locale: string;
}

const I18nContext = createContext<I18n | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is no reason to refuse it.
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const table = TABLES[lang];
    const t = (key: TranslationKey, params?: Params) => format(table[key], params);
    return {
      lang,
      setLang,
      t,
      tOr: (key, fallback, params) =>
        key in table ? format(table[key as TranslationKey], params) : fallback,
      tn: (base, n, params) => format(table[`${base}.${n === 1 ? 'one' : 'other'}`], { n, ...params }),
      logLine: (entry) => {
        const key = `log.${entry.kind}` as TranslationKey;
        // A kind we have no sentence for falls back to whatever the server
        // sent: games logged before the log became structured still read fine.
        if (!(key in table)) return entry.text ?? entry.kind;
        return format(table[key], entry.params);
      },
      errorText: (code, fallback) => {
        const key = `err.${code}` as TranslationKey;
        if (code && key in table) return table[key];
        return fallback || t('generic.error');
      },
      locale: LOCALES[lang],
    };
  }, [lang, setLang]);

  // Keep the document in step: screen readers and browser translation both
  // read `lang`, and the tab title is the one string nobody can click away.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = TABLES[lang]['meta.title'];
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <LanguageProvider>');
  return ctx;
}

/** The common case: just the translate function. */
export function useT(): I18n['t'] {
  return useI18n().t;
}

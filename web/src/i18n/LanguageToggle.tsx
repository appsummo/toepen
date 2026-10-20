import { LANGS, useI18n, type Lang } from './index.js';

const LABEL: Record<Lang, string> = { nl: 'NL', en: 'EN' };

/**
 * A two-state language switch. Deliberately tiny and always in the same place:
 * it is chrome, not a feature, and it has to stay reachable on a phone without
 * eating the header.
 */
export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('lang.label')}
      style={{
        display: 'inline-flex',
        borderRadius: 999,
        border: '1px solid rgba(201,143,61,0.45)',
        overflow: 'hidden',
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      {LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={active}
            title={t(code === 'nl' ? 'lang.nl' : 'lang.en')}
            style={{
              padding: compact ? '4px 9px' : '5px 12px',
              fontSize: compact ? 11 : 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: active ? '#3a2408' : 'var(--parchment)',
              background: active ? 'linear-gradient(180deg, var(--gold-bright), var(--gold))' : 'transparent',
              opacity: active ? 1 : 0.75,
            }}
          >
            {LABEL[code]}
          </button>
        );
      })}
    </div>
  );
}

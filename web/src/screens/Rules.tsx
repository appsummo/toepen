import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { RULES } from '../content/rules.js';
import { SiteHeader } from '../components/SiteHeader.js';

export function Rules() {
  const { t, lang } = useI18n();
  const sections = RULES[lang];

  return (
    <div className="page">
      <SiteHeader showRules={false} />

      <main className="rules-main">
        <h1 className="rules-title">{t('rules.title')}</h1>
        <p className="rules-lead">{t('rules.lead')}</p>

        <div className="rules-sections">
          {sections.map((section) => (
            <section key={section.title} className="parchment rules-card">
              <h2 className="rules-heading">{section.title}</h2>
              <ul className="rules-list">
                {section.items.map((item) => (
                  <li key={item.text}>
                    {item.text}
                    {item.sub && (
                      <ul className="rules-sublist">
                        {item.sub.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <Link to="/" className="btn btn-primary rules-cta">
          {t('rules.cta')}
        </Link>
      </main>
    </div>
  );
}

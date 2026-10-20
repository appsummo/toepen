import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { LanguageToggle } from '../i18n/LanguageToggle.js';

/**
 * The header shared by the pages outside a game. The nav only ever holds links
 * that go somewhere — a label that does nothing reads as a broken feature.
 */
export function SiteHeader({ showRules = true }: { showRules?: boolean }) {
  const t = useT();

  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Toepen">
        <span className="wordmark brand-mark">TOEPEN</span>
        <span className="suits brand-suits">♠♥♣♦</span>
      </Link>
      <nav className="site-nav">
        {showRules ? (
          <Link to="/regels" className="site-nav-link">
            {t('nav.rules')}
          </Link>
        ) : (
          <Link to="/" className="site-nav-link">
            {t('nav.home')}
          </Link>
        )}
        <LanguageToggle />
      </nav>
    </header>
  );
}

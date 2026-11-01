import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Permission } from '@h-os/contracts';
import { Button } from '@h-os/ui';
import { hasPermission, useSession } from '@h-os/web-client';
import { LanguageSwitcher } from './language-switcher.js';

interface NavEntry {
  readonly to: '/' | '/employees' | '/organization' | '/me';
  readonly labelKey: string;
  readonly permission: Permission | null;
}

const NAV: readonly NavEntry[] = [
  { to: '/', labelKey: 'nav.home', permission: null },
  { to: '/employees', labelKey: 'nav.employees', permission: Permission.HR_EMPLOYEE_READ },
  {
    to: '/organization',
    labelKey: 'nav.organization',
    permission: Permission.HR_ORGANIZATION_READ,
  },
  { to: '/me', labelKey: 'nav.myProfile', permission: Permission.HR_EMPLOYEE_READ },
];

/**
 * The one shell every app renders inside: brand, launcher navigation, language, user menu and a
 * mobile drawer (UX-001). Navigation is filtered by the session's grants, while the server
 * remains the authority for every request (UX-002).
 */
export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const { t } = useTranslation();
  const session = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = session.user;

  const entries = NAV.filter(
    (entry) => entry.permission === null || hasPermission(user, entry.permission),
  );

  const closeMenu = (): void => setMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 no-underline" onClick={closeMenu}>
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-lg bg-primary font-semibold text-on-primary"
            >
              H
            </span>
            <span className="hidden text-base font-semibold text-ink-strong sm:inline">
              {t('app.name')}
            </span>
          </Link>

          <nav aria-label={t('nav.apps')} className="hidden flex-1 items-center gap-1 md:flex">
            {entries.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="hos-nav-link"
                activeProps={{ 'aria-current': 'page' }}
                activeOptions={{ exact: entry.to === '/' }}
              >
                {t(entry.labelKey)}
              </Link>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <details className="relative">
              <summary className="hos-button hos-button-secondary hos-button-sm cursor-pointer list-none">
                <span className="max-w-40 truncate">{user?.displayName}</span>
              </summary>
              <div className="absolute end-0 z-50 mt-2 w-64 rounded-lg border border-line bg-surface p-3 shadow-raised">
                <p className="text-sm font-semibold text-ink-strong">{user?.displayName}</p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{user?.email}</p>
                <div className="mt-3 border-t border-line pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      void session.logout();
                    }}
                  >
                    {t('auth.signOut')}
                  </Button>
                </div>
              </div>
            </details>

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
            </Button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            id="mobile-nav"
            aria-label={t('nav.apps')}
            className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden"
          >
            {entries.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="hos-nav-link"
                activeProps={{ 'aria-current': 'page' }}
                activeOptions={{ exact: entry.to === '/' }}
                onClick={closeMenu}
              >
                {t(entry.labelKey)}
              </Link>
            ))}
            <div className="mt-2 border-t border-line pt-2 sm:hidden">
              <LanguageSwitcher />
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-4 text-center text-xs text-ink-muted sm:px-6">
        {t('shell.footer', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}

/** Full-page state used before the session is known, so no private screen ever flashes (UX-008). */
export function BootScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center bg-canvas" role="status">
      <p className="text-sm text-ink-muted">{t('common.loading')}</p>
    </div>
  );
}

/** Terminal session failure: the shell cannot know who the caller is. */
export function SessionErrorScreen({ onRetry }: { readonly onRetry: () => void }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="hos-card flex max-w-md flex-col gap-3 hos-card-body">
        <h1 className="hos-card-title">{t('errors.network')}</h1>
        <Button onClick={onRetry}>{t('common.retry')}</Button>
      </div>
    </div>
  );
}

export function ForbiddenScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink-strong">{t('shell.forbiddenTitle')}</h1>
      <p className="text-sm text-ink-muted">{t('shell.forbiddenBody')}</p>
      <Link to="/" className="hos-button hos-button-secondary mt-2">
        {t('shell.goHome')}
      </Link>
    </div>
  );
}

export function NotFoundScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink-strong">{t('shell.notFoundTitle')}</h1>
      <p className="text-sm text-ink-muted">{t('shell.notFoundBody')}</p>
      <Link to="/" className="hos-button hos-button-secondary mt-2">
        {t('shell.goHome')}
      </Link>
    </div>
  );
}

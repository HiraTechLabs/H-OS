import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Permission } from '@h-os/contracts';
import { Button, ThemeSwitcher } from '@h-os/ui';
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

  const themeLabels = {
    settings: t('theme.settings'),
    light: t('theme.light'),
    dark: t('theme.dark'),
    system: t('theme.system'),
    paletteClassic: t('theme.paletteClassic'),
    paletteTeal: t('theme.paletteTeal'),
    paletteCarbon: t('theme.paletteCarbon'),
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas overflow-x-clip selection:bg-primary/20">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
      >
        {t('nav.skipToContent')}
      </a>

      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur-md transition-colors">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 no-underline group" onClick={closeMenu}>
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover font-bold text-on-primary shadow-xs ring-1 ring-white/10 group-hover:scale-105 transition-transform">
              <span className="text-base tracking-wider">H</span>
            </div>
            <span className="hidden text-base font-bold tracking-tight text-ink-strong sm:inline">
              {t('app.name')}
            </span>
          </Link>

          <nav aria-label={t('nav.apps')} className="hidden flex-1 items-center gap-1.5 md:flex ms-4">
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
            <ThemeSwitcher labels={themeLabels} />

            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            <details className="relative">
              <summary className="hos-button hos-button-secondary hos-button-sm cursor-pointer list-none flex items-center gap-2">
                <span className="size-2 rounded-full bg-success" />
                <span className="max-w-36 truncate font-medium">{user?.displayName}</span>
              </summary>
              <div className="absolute end-0 z-50 mt-2 w-64 rounded-xl border border-line bg-surface p-3 shadow-raised">
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
            className="flex flex-col gap-1.5 border-t border-line bg-surface px-4 py-3 md:hidden"
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
            <div className="mt-2 border-t border-line pt-2 sm:hidden flex items-center justify-between">
              <LanguageSwitcher />
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-line/60 bg-surface/50 py-4 text-center text-xs text-ink-muted">
        <p>{t('shell.footer', { year: new Date().getFullYear().toString() })}</p>
      </footer>
    </div>
  );
}

export function BootScreen(): ReactNode {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-on-primary font-bold text-xl shadow-md animate-pulse">
          H
        </div>
        <p className="text-sm font-medium text-ink-muted">Loading H-OS…</p>
      </div>
    </div>
  );
}

export function ForbiddenScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
      <div className="rounded-2xl border border-line bg-surface p-8 max-w-md shadow-card">
        <h2 className="text-xl font-bold text-ink-strong">{t('shell.forbiddenTitle')}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t('shell.forbiddenBody')}</p>
        <div className="mt-6">
          <Link to="/" className="hos-button hos-button-primary">
            {t('shell.goHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NotFoundScreen(): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6">
      <div className="rounded-2xl border border-line bg-surface p-8 max-w-md shadow-card">
        <h2 className="text-xl font-bold text-ink-strong">{t('shell.notFoundTitle')}</h2>
        <p className="mt-2 text-sm text-ink-muted">{t('shell.notFoundBody')}</p>
        <div className="mt-6">
          <Link to="/" className="hos-button hos-button-primary">
            {t('shell.goHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SessionErrorScreen({ onRetry }: { readonly onRetry: () => void }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="rounded-2xl border border-line bg-surface p-8 max-w-md text-center shadow-card">
        <h2 className="text-lg font-bold text-ink-strong">Session connection failed</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Could not communicate with the H-OS authentication service.
        </p>
        <div className="mt-6">
          <Button onClick={onRetry}>{t('common.retry')}</Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Permission } from '@h-os/contracts';
import { Button, ThemeSwitcher } from '@h-os/ui';
import { getRegisteredApps, hasPermission, useSession } from '@h-os/web-client';
import { LanguageSwitcher } from './language-switcher.js';
import { GlobalDock } from './global-dock.js';
import { CommandPalette } from './command-palette.js';
import { getAppIcon } from './icons.js';

interface SubNavEntry {
  readonly to: '/employees' | '/organization' | '/me';
  readonly labelKey: string;
  readonly permission: Permission | null;
}

const HR_NAV: readonly SubNavEntry[] = [
  { to: '/employees', labelKey: 'nav.employees', permission: Permission.HR_EMPLOYEE_READ },
  { to: '/organization', labelKey: 'nav.organization', permission: Permission.HR_ORGANIZATION_READ },
  { to: '/me', labelKey: 'nav.myProfile', permission: Permission.HR_EMPLOYEE_READ },
];

/**
 * The unified H-OS Operating System Shell (UX-001, DEC-0010):
 * - Global Dock (persistent inline-start edge / mobile bottom bar)
 * - System Bar (application switcher, application-local domain navigation, command search, theme, language, user menu)
 * - Command Palette (Ctrl+K/Cmd+K)
 * - Application workspace rendering boundary
 */
export function AppShell({ children }: { readonly children: ReactNode }): ReactNode {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const user = session.user;
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';

  const [paletteOpen, setPaletteOpen] = useState(false);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useState(() => {
    if (typeof window === 'undefined') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Query registered apps from authoritative backend
  const { data: apps = [] } = useQuery({
    queryKey: ['apps', user?.accountId],
    queryFn: getRegisteredApps,
    staleTime: 60_000,
  });

  const isHrActive = currentPath.startsWith('/employees') || currentPath.startsWith('/organization') || currentPath.startsWith('/me') || currentPath.startsWith('/apps/hr');

  // Filter HR application navigation by actual user grants
  const hrEntries = HR_NAV.filter(
    (entry) => entry.permission === null || hasPermission(user, entry.permission),
  );

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
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink antialiased">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50"
      >
        {t('nav.skipToContent')}
      </a>

      {/* Global Dock (Desktop vertical dock / Mobile bottom navigation) */}
      <GlobalDock apps={apps} onOpenPalette={() => setPaletteOpen(true)} />

      {/* Main OS Viewport Frame */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top System Bar */}
        <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-md transition-colors sm:px-6">
          {/* Current Application Identity & Local Domain Navigation */}
          <div className="flex items-center gap-4 min-w-0">
            {isHrActive ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-semibold text-ink-strong border border-line">
                  <span className="text-primary">{getAppIcon('hr')}</span>
                  <span>H-HR</span>
                </div>

                {/* H-HR Application-Local Sub-Navigation */}
                <nav className="hidden sm:flex items-center gap-1" aria-label="H-HR Modules">
                  {hrEntries.map((entry) => (
                    <Link
                      key={entry.to}
                      to={entry.to}
                      className="hos-nav-link text-xs py-1 px-2.5"
                      activeProps={{ 'aria-current': 'page' }}
                    >
                      {t(entry.labelKey)}
                    </Link>
                  ))}
                </nav>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent" />
                <span className="text-sm font-bold text-ink-strong tracking-tight">
                  {t('app.name')} <span className="font-normal text-xs text-ink-muted">· Workspace</span>
                </span>
              </div>
            )}
          </div>

          {/* System Utilities: Command Palette Trigger, Theme, Language, Profile */}
          <div className="flex items-center gap-2.5">
            {/* Quick Command Trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs text-ink-muted hover:border-primary hover:text-ink-strong transition-colors shadow-xs"
              title={`${lang === 'ar' ? 'البحث والأوامر' : 'Command Search'} (Ctrl+K)`}
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden lg:inline">{lang === 'ar' ? 'بحث سريع...' : 'Quick search...'}</span>
              <kbd className="hos-kbd text-[10px] hidden sm:inline">⌘K</kbd>
            </button>

            <ThemeSwitcher labels={themeLabels} />

            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            {/* User Session Menu */}
            <details className="relative">
              <summary className="hos-button hos-button-secondary hos-button-sm cursor-pointer list-none flex items-center gap-2 py-1 px-2.5">
                <span className="size-2 rounded-full bg-success" />
                <span className="max-w-28 truncate font-medium text-xs">{user?.displayName}</span>
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
          </div>
        </header>

        {/* Mobile Sub-Navigation Bar for active H-HR module (under system bar) */}
        {isHrActive ? (
          <nav
            aria-label="H-HR Mobile Navigation"
            className="sm:hidden flex items-center gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2 text-xs"
          >
            {hrEntries.map((entry) => (
              <Link
                key={entry.to}
                to={entry.to}
                className="hos-nav-link text-xs py-1 px-2.5 whitespace-nowrap"
                activeProps={{ 'aria-current': 'page' }}
              >
                {t(entry.labelKey)}
              </Link>
            ))}
          </nav>
        ) : null}

        {/* Workspace Content Canvas */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 pb-20 md:pb-8 max-w-7xl w-full mx-auto"
        >
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        apps={apps}
      />
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

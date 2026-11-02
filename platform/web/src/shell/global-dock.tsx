import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ApplicationDefinition } from '@h-os/contracts';
import { getAppIcon } from './icons.js';

export interface GlobalDockProps {
  readonly apps: readonly ApplicationDefinition[];
  readonly onOpenPalette: () => void;
}

export function GlobalDock({ apps, onOpenPalette }: GlobalDockProps): ReactNode {
  const { t, i18n } = useTranslation();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';

  const isHomeActive = currentPath === '/';
  const isHrActive = currentPath.startsWith('/employees') || currentPath.startsWith('/organization') || currentPath.startsWith('/me');

  // Filter to available applications, respecting dock max visible capacity of 7
  const availableApps = apps.filter((app) => app.availability === 'available');
  const visibleApps = availableApps.slice(0, 7);
  const hasOverflow = availableApps.length > 7;

  return (
    <>
      {/* 1. Desktop Vertical Dock (inline-start edge, >= 768px) */}
      <aside
        aria-label={lang === 'ar' ? 'شريط تطبيقات H-OS' : 'Global Application Dock'}
        className="hidden md:flex flex-col items-center justify-between py-3 w-16 border-e border-line bg-surface/95 backdrop-blur-md z-30 shrink-0 select-none"
      >
        <div className="flex flex-col items-center gap-4 w-full">
          {/* H-OS Logo / Brand Anchor */}
          <Link
            to="/"
            className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-on-primary font-bold shadow-xs hover:scale-105 active:scale-95 transition-all"
            title={t('app.name')}
            aria-label={t('app.name')}
          >
            <span className="text-lg tracking-wider">H</span>
          </Link>

          <div className="w-8 border-t border-line/60" />

          {/* Desktop App Icons */}
          <nav className="flex flex-col items-center gap-2.5 w-full px-2" aria-label="Applications">
            {/* Home Anchor */}
            <Link
              to="/"
              className={`group relative flex size-11 items-center justify-center rounded-xl transition-all ${
                isHomeActive
                  ? 'bg-primary/10 text-primary shadow-xs font-semibold'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink-strong'
              }`}
              title={t('nav.home')}
              aria-label={t('nav.home')}
              aria-current={isHomeActive ? 'page' : undefined}
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              {isHomeActive ? (
                <span className="absolute start-0.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>

            {/* Dynamic Registered Apps */}
            {visibleApps.map((app) => {
              const displayName = app.displayName[lang] || app.displayName.en || app.name;
              const isAppActive = app.id === 'hr' ? isHrActive : currentPath.startsWith(app.route);
              const destination = app.id === 'hr' ? '/employees' : app.route;

              return (
                <Link
                  key={app.id}
                  to={destination}
                  className={`group relative flex size-11 items-center justify-center rounded-xl transition-all ${
                    isAppActive
                      ? 'bg-primary/10 text-primary shadow-xs font-semibold ring-1 ring-primary/20'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink-strong'
                  }`}
                  title={displayName}
                  aria-label={displayName}
                  aria-current={isAppActive ? 'page' : undefined}
                >
                  {getAppIcon(app.icon)}
                  {isAppActive ? (
                    <span className="absolute start-0.5 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent" />
                  ) : null}
                </Link>
              );
            })}

            {/* Overflow Trigger if more than 7 apps */}
            {hasOverflow ? (
              <button
                type="button"
                onClick={onOpenPalette}
                className="group relative flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink-strong transition-all"
                title={lang === 'ar' ? 'المزيد من التطبيقات...' : 'More Applications...'}
                aria-label={lang === 'ar' ? 'المزيد من التطبيقات' : 'More Applications'}
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </button>
            ) : null}
          </nav>
        </div>

        {/* Desktop Quick Command Search Trigger at Bottom of Dock */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex size-10 items-center justify-center rounded-xl text-ink-muted hover:bg-surface-muted hover:text-ink-strong transition-colors"
            title={`${lang === 'ar' ? 'لوحة الأوامر' : 'Command Palette'} (Ctrl+K)`}
            aria-label={lang === 'ar' ? 'فتح لوحة الأوامر' : 'Open Command Palette'}
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </aside>

      {/* 2. Mobile Bottom Dock (< 768px) */}
      <nav
        aria-label={lang === 'ar' ? 'تنقل الهاتف السفلي' : 'Mobile Bottom Navigation'}
        className="md:hidden fixed bottom-0 start-0 end-0 z-40 flex h-14 items-center justify-around border-t border-line bg-surface/95 backdrop-blur-md px-2"
      >
        {/* Home */}
        <Link
          to="/"
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            isHomeActive ? 'text-primary' : 'text-ink-muted'
          }`}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px]">{t('nav.home')}</span>
        </Link>

        {/* H-HR (Primary Active Enterprise Workspace) */}
        <Link
          to="/employees"
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            isHrActive ? 'text-primary' : 'text-ink-muted'
          }`}
        >
          {getAppIcon('hr')}
          <span className="text-[10px]">H-HR</span>
        </Link>

        {/* Command Search */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium text-ink-muted"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-[10px]">{lang === 'ar' ? 'بحث' : 'Search'}</span>
        </button>

        {/* My Profile */}
        <Link
          to="/me"
          className={`flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition-colors ${
            currentPath === '/me' ? 'text-primary' : 'text-ink-muted'
          }`}
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px]">{lang === 'ar' ? 'ملفي' : 'Profile'}</span>
        </Link>
      </nav>
    </>
  );
}

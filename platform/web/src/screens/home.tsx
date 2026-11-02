import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApplicationDefinition } from '@h-os/contracts';
import { Badge, EmptyState, Input, Skeleton } from '@h-os/ui';
import { getRegisteredApps, useSession } from '@h-os/web-client';
import { getAppIcon } from '../shell/icons.js';

const RECENT_APPS_KEY = 'hos-recent-apps';

function recordRecentApp(appId: string): void {
  try {
    const raw = localStorage.getItem(RECENT_APPS_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const updated = [appId, ...existing.filter((id) => id !== appId)].slice(0, 4);
    localStorage.setItem(RECENT_APPS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function getRecentAppIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_APPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Home is the H-OS Workspace Desktop:
 * - Personalized greeting and real system date/time
 * - Active Workspaces: prominent, icon-first launch tiles with sub-navigation links
 * - Lightweight client-side recent application tracking
 * - Platform Roadmap: compact, secondary representations of in-development applications
 * - Responsive single-column mobile layout with zero horizontal overflow
 */
export function HomeScreen(): ReactNode {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const [query, setQuery] = useState('');
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [recentIds] = useState<string[]>(() => getRecentAppIds());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data: apps = [], isLoading, isError } = useQuery<readonly ApplicationDefinition[]>({
    queryKey: ['apps', user?.accountId],
    queryFn: getRegisteredApps,
    staleTime: 60_000,
  });

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(currentTime);
  }, [currentTime, lang]);

  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(currentTime);
  }, [currentTime, lang]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((app) => {
      const name = (app.displayName[lang] || app.displayName.en || app.name).toLowerCase();
      const desc = (app.description[lang] || app.description.en || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [apps, query, lang]);

  const activeApps = useMemo(() => {
    return filteredApps.filter((app) => app.availability === 'available');
  }, [filteredApps]);

  const roadmapApps = useMemo(() => {
    return filteredApps.filter((app) => app.availability !== 'available');
  }, [filteredApps]);

  const recentApps = useMemo(() => {
    if (recentIds.length === 0) return [];
    return recentIds
      .map((id) => apps.find((a) => a.id === id && a.availability === 'available'))
      .filter((app): app is ApplicationDefinition => app !== undefined);
  }, [recentIds, apps]);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Operating System Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-ink-muted mb-1">
            <span>{formattedDate}</span>
            <span>·</span>
            <span className="font-mono text-ink-strong">{formattedTime}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
            {t('home.title', { name: user?.displayName ?? '' })}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t('home.subtitle')}</p>
        </div>

        {/* Global Search Input */}
        <div className="w-full md:w-80">
          <div className="relative">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="ps-9 py-2 text-sm shadow-xs"
            />
            <span className="pointer-events-none absolute start-3 top-2.5 text-ink-muted">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 shadow-card">
              <Skeleton className="size-11 rounded-xl" />
              <Skeleton className="h-5 w-32 mt-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title={t('common.retry')}
          description="Could not load applications from the authoritative backend registry."
        />
      ) : apps.length === 0 ? (
        <EmptyState title={t('shell.noApps')} description={t('shell.noAppsBody')} />
      ) : filteredApps.length === 0 ? (
        <EmptyState
          title={t('home.noSearchResults')}
          description={t('home.searchPlaceholder')}
        />
      ) : (
        <div className="flex flex-col gap-10">
          {/* 2. Recent Applications (Visible only when genuine recent apps exist) */}
          {recentApps.length > 0 && !query ? (
            <section aria-labelledby="recent-apps-heading" className="flex flex-col gap-3">
              <h2 id="recent-apps-heading" className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                {lang === 'ar' ? 'التطبيقات الأخيرة' : 'Recent Workspaces'}
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                {recentApps.map((app) => {
                  const displayName = app.displayName[lang] || app.displayName.en || app.name;
                  const destination = app.id === 'hr' ? '/employees' : app.route;
                  return (
                    <Link
                      key={app.id}
                      to={destination}
                      onClick={() => recordRecentApp(app.id)}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink-strong hover:border-primary/50 hover:bg-surface-muted transition-all shadow-xs"
                    >
                      <span className="text-primary">{getAppIcon(app.icon)}</span>
                      <span>{displayName}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* 3. Section 1: Active Production Workspaces (Prominent Launcher Tiles) */}
          {activeApps.length > 0 ? (
            <section aria-labelledby="active-apps-heading" className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <h2 id="active-apps-heading" className="text-base font-bold text-ink-strong tracking-tight">
                    {t('home.activeApps')}
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('home.activeAppsDesc')}</p>
                </div>
                <Badge tone="success" className="font-semibold text-xs">
                  {activeApps.length} {t('home.statusAvailable')}
                </Badge>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {activeApps.map((app) => {
                  const displayName = app.displayName[lang] || app.displayName.en || app.name;
                  const description = app.description[lang] || app.description.en;
                  const destination = app.id === 'hr' ? '/employees' : app.route;

                  return (
                    <div
                      key={app.id}
                      className="group flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-card hover:border-primary/50 hover:shadow-raised transition-all"
                    >
                      <div>
                        {/* Icon and Active Indicator */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-all">
                            {getAppIcon(app.icon)}
                          </div>
                          <span className="flex items-center gap-1.5 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-semibold text-success">
                            <span className="size-1.5 rounded-full bg-success animate-pulse" />
                            {t('home.statusAvailable')}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-4 text-base font-bold text-ink-strong group-hover:text-primary transition-colors">
                          {displayName}
                        </h3>
                        <p className="mt-1.5 text-xs text-ink-muted leading-relaxed line-clamp-2">
                          {description}
                        </p>
                      </div>

                      {/* Launch Footer & Direct Sub-Module Deep Links */}
                      <div className="mt-6 pt-4 border-t border-line flex items-center justify-between">
                        {app.id === 'hr' ? (
                          <div className="flex items-center gap-2 text-xs">
                            <Link to="/employees" className="hos-link text-xs">
                              {t('nav.employees')}
                            </Link>
                            <span className="text-ink-muted">·</span>
                            <Link to="/organization" className="hos-link text-xs">
                              {t('nav.organization')}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-ink-muted">{app.route}</span>
                        )}

                        <Link
                          to={destination}
                          onClick={() => recordRecentApp(app.id)}
                          className="hos-button hos-button-primary hos-button-sm group-hover:shadow-xs"
                        >
                          <span>{t('home.open')}</span>
                          <svg className="size-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* 4. Section 2: Platform Roadmap (Systems in Active Engineering) */}
          {roadmapApps.length > 0 ? (
            <section aria-labelledby="roadmap-apps-heading" className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div>
                  <h2 id="roadmap-apps-heading" className="text-base font-bold text-ink-strong tracking-tight">
                    {t('home.upcomingApps')}
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('home.upcomingAppsDesc')}</p>
                </div>
                <Badge tone="neutral" className="text-xs">
                  {roadmapApps.length} {t('home.statusDevelopment')}
                </Badge>
              </div>

              {/* Compact vertical list / 2-column grid with clear touch targets */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roadmapApps.map((app) => {
                  const displayName = app.displayName[lang] || app.displayName.en || app.name;
                  const description = app.description[lang] || app.description.en;

                  return (
                    <div
                      key={app.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 p-3.5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                          {getAppIcon(app.icon)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-ink-strong truncate">{displayName}</p>
                          <p className="text-[11px] text-ink-muted truncate">{description}</p>
                        </div>
                      </div>

                      <span className="shrink-0 rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                        {t('home.statusDevelopment')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

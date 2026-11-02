import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApplicationDefinition } from '@h-os/contracts';
import { Badge, Card, EmptyState, Input, Skeleton } from '@h-os/ui';
import { getRegisteredApps, useSession } from '@h-os/web-client';

function getAppIcon(appId: string): ReactNode {
  switch (appId) {
    case 'hr':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'finance':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'sales':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      );
    case 'inventory':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    case 'archive':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      );
    case 'rooms':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case 'camera':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    case 'assets':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
    case 'chat':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'tasks':
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
  }
}

/**
 * Home is the OS Workspace launcher: it displays the official applications returned by the
 * authoritative backend Application Registry (REG-001) in a high-hierarchy OS desktop environment.
 */
export function HomeScreen(): ReactNode {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const [query, setQuery] = useState('');

  const { data: apps = [], isLoading, isError } = useQuery<readonly ApplicationDefinition[]>({
    queryKey: ['apps', user?.accountId],
    queryFn: getRegisteredApps,
    staleTime: 60_000,
  });

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

  return (
    <div className="flex flex-col gap-8">
      {/* OS Workspace Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface via-surface to-surface-muted p-6 sm:p-8 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-accent-strong mb-3">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              <span>{t('home.systemHealthy')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
              {t('home.title', { name: user?.displayName ?? '' })}
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-ink-muted">
              {t('home.subtitle')}
            </p>
          </div>

          {/* Quick Search */}
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
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title={t('common.retry')}
          description="Could not load applications from the authoritative registry."
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
          {/* Section 1: Active Production Workspaces */}
          {activeApps.length > 0 ? (
            <section aria-labelledby="active-apps-heading" className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2 id="active-apps-heading" className="text-base font-bold text-ink-strong tracking-tight">
                    {t('home.activeApps')}
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('home.activeAppsDesc')}</p>
                </div>
                <Badge tone="success" className="font-semibold">
                  {activeApps.length} {t('home.statusAvailable')}
                </Badge>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {activeApps.map((app) => {
                  const displayName = app.displayName[lang] || app.displayName.en || app.name;
                  const description = app.description[lang] || app.description.en;
                  const destination = app.id === 'hr' ? '/employees' : app.route;

                  return (
                    <Card
                      key={app.id}
                      className="group flex flex-col justify-between border-line/90 hover:border-primary/50 hover:shadow-raised transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                          {getAppIcon(app.id)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-ink-strong group-hover:text-primary transition-colors truncate">
                              {displayName}
                            </h3>
                            <span className="size-2 rounded-full bg-success shrink-0" />
                          </div>
                          <p className="mt-1 text-xs text-ink-muted line-clamp-2 leading-relaxed">
                            {description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-line flex items-center justify-between">
                        {app.id === 'hr' ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Link to="/employees" className="hos-link text-xs">
                              {t('nav.employees')}
                            </Link>
                            <span className="text-ink-muted">·</span>
                            <Link to="/organization" className="hos-link text-xs">
                              {t('nav.organization')}
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-muted font-mono">{app.route}</span>
                        )}

                        <Link
                          to={destination}
                          className="hos-button hos-button-primary hos-button-sm group-hover:shadow-sm"
                        >
                          <span>{t('home.open')}</span>
                          <svg className="size-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Section 2: Platform Roadmap / Systems Under Active Engineering */}
          {roadmapApps.length > 0 ? (
            <section aria-labelledby="roadmap-apps-heading" className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h2 id="roadmap-apps-heading" className="text-base font-bold text-ink-strong tracking-tight">
                    {t('home.upcomingApps')}
                  </h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('home.upcomingAppsDesc')}</p>
                </div>
                <Badge tone="neutral">
                  {roadmapApps.length} {t('home.statusDevelopment')}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {roadmapApps.map((app) => {
                  const displayName = app.displayName[lang] || app.displayName.en || app.name;
                  const description = app.description[lang] || app.description.en;

                  return (
                    <div
                      key={app.id}
                      className="flex flex-col justify-between rounded-xl border border-line-strong/60 bg-surface/60 p-4 transition-colors"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                          {getAppIcon(app.id)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-ink-strong truncate">
                              {displayName}
                            </h3>
                            <Badge tone="neutral" className="text-[10px] py-0 px-1.5">
                              {t('home.statusDevelopment')}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-ink-muted line-clamp-2">
                            {description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs text-ink-muted">
                        <span className="font-mono text-[11px]">{app.route}</span>
                        <span className="italic text-[11px]">{t('home.statusDevelopment')}</span>
                      </div>
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

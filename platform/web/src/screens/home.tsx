import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApplicationDefinition } from '@h-os/contracts';
import { Card, EmptyState, PageHeader } from '@h-os/ui';
import { getRegisteredApps, useSession } from '@h-os/web-client';

/**
 * Home is the launcher: it displays the official applications returned by the authoritative
 * backend Application Registry (REG-001). Availability is honestly reflected: applications
 * under development display clear status indicators.
 */
export function HomeScreen(): ReactNode {
  const { t, i18n } = useTranslation();
  const { user } = useSession();
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';

  const { data: apps = [], isLoading } = useQuery<readonly ApplicationDefinition[]>({
    queryKey: ['apps', user?.accountId],
    queryFn: getRegisteredApps,
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('home.title', { name: user?.displayName ?? '' })}
        description={t('home.subtitle')}
      />

      {isLoading ? (
        <p role="status" className="py-10 text-center text-sm text-ink-muted">
          {t('common.loading')}
        </p>
      ) : apps.length === 0 ? (
        <EmptyState title={t('shell.noApps')} description={t('shell.noAppsBody')} />
      ) : (
        <section aria-labelledby="launcher-heading" className="flex flex-col gap-3">
          <h2 id="launcher-heading" className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            {t('home.launcher')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const displayName = app.displayName[lang] || app.displayName.en || app.name;
              const description = app.description[lang] || app.description.en;
              const isAvailable = app.availability === 'available';

              // Map app route to shell route: H-HR is implemented at /employees, /organization, /me
              const destination = app.id === 'hr' ? '/employees' : app.route;

              return (
                <Card
                  key={app.id}
                  title={displayName}
                  description={description}
                  actions={
                    isAvailable ? (
                      <Link className="hos-button hos-button-primary hos-button-sm" to={destination}>
                        {t('home.open')}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                        {lang === 'ar' ? 'قيد التطوير' : 'Under Development'}
                      </span>
                    )
                  }
                >
                  <p className="text-sm text-ink-muted">{description}</p>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs text-ink-muted">{t('shell.signedInAs', { name: user?.displayName ?? '' })}</p>
    </div>
  );
}

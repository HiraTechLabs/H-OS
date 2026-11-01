import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Permission } from '@h-os/contracts';
import { Card, EmptyState, PageHeader } from '@h-os/ui';
import { hasPermission, useSession } from '@h-os/web-client';

interface LauncherEntry {
  readonly to: '/employees' | '/organization' | '/me';
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly permission: Permission;
}

const LAUNCHER: readonly LauncherEntry[] = [
  {
    to: '/employees',
    titleKey: 'home.employeesTitle',
    bodyKey: 'home.employeesBody',
    permission: Permission.HR_EMPLOYEE_READ,
  },
  {
    to: '/organization',
    titleKey: 'home.organizationTitle',
    bodyKey: 'home.organizationBody',
    permission: Permission.HR_ORGANIZATION_READ,
  },
  {
    to: '/me',
    titleKey: 'home.selfTitle',
    bodyKey: 'home.selfBody',
    permission: Permission.HR_EMPLOYEE_READ,
  },
];

/**
 * Home is the launcher: it lists only the apps the session may open, computed from the server's
 * permission list (UX-002). An account with no app access gets an explained empty state rather
 * than an empty grid.
 */
export function HomeScreen(): ReactNode {
  const { t } = useTranslation();
  const { user } = useSession();
  const entries = LAUNCHER.filter((entry) => hasPermission(user, entry.permission));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('home.title', { name: user?.displayName ?? '' })}
        description={t('home.subtitle')}
      />

      {entries.length === 0 ? (
        <EmptyState title={t('shell.noApps')} description={t('shell.noAppsBody')} />
      ) : (
        <section aria-labelledby="launcher-heading" className="flex flex-col gap-3">
          <h2 id="launcher-heading" className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
            {t('home.launcher')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <Card
                key={entry.to}
                title={t(entry.titleKey)}
                description={t(entry.bodyKey)}
                actions={
                  <Link className="hos-button hos-button-primary hos-button-sm" to={entry.to}>
                    {t('home.open')}
                  </Link>
                }
              >
                <p className="text-sm text-ink-muted">{t(entry.bodyKey)}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-ink-muted">{t('shell.signedInAs', { name: user?.displayName ?? '' })}</p>
    </div>
  );
}

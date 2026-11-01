import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { EmployeeProfile } from '@h-os/contracts';
import { Alert, EmptyState, PageHeader, Skeleton } from '@h-os/ui';
import { ApiError } from '@h-os/web-client';
import { fetchMyProfile } from '../api/employees.js';
import { EmployeeProfileView } from '../components/employee-profile-view.js';
import { ErrorAlert } from '../components/error-alert.js';
import { Localized } from '../components/localized.js';

/**
 * Self-service profile. Employees get the same profile body with every management action
 * suppressed; an account that is not linked to an employee record sees an explained empty
 * state instead of a raw 403 (HHR-UX-004, UX-008).
 */
export function MyProfileScreen(): ReactNode {
  const { t } = useTranslation();
  const profile = useQuery<EmployeeProfile>({
    queryKey: ['employee', 'me'],
    queryFn: fetchMyProfile,
    retry: false,
  });

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.isForbidden) {
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title={t('hr.self.title')} description={t('hr.self.subtitle')} />
          <EmptyState
            title={t('hr.self.notLinked')}
            description={t('hr.self.notLinkedBody')}
          />
        </div>
      );
    }
    return <ErrorAlert error={profile.error} onRetry={() => void profile.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<Localized value={profile.data.summary.displayName} />}
        description={t('hr.self.subtitle')}
      />
      <Alert tone="info">{t('hr.self.subtitle')}</Alert>
      <EmployeeProfileView
        profile={profile.data}
        canManage={false}
        canChangeStatus={false}
        onChanged={() => void profile.refetch()}
      />
    </div>
  );
}

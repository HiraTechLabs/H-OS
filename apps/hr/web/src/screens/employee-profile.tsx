import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  EmployeeProfile,
  EmployeeSearchResult,
  OrganizationOverview,
} from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { Alert, PageHeader, Skeleton } from '@h-os/ui';
import { ApiError, hasPermission, useSession } from '@h-os/web-client';
import { fetchEmployee, fetchEmployees } from '../api/employees.js';
import { fetchOrganization } from '../api/organization.js';
import { EmployeeProfileView } from '../components/employee-profile-view.js';
import { ErrorAlert } from '../components/error-alert.js';
import { Localized } from '../components/localized.js';

/**
 * HR-facing profile route. The three queries are independent: a caller who may read employees
 * but not the organization structure still sees the whole profile, minus the assignment picker
 * (HHR-UX-002, SEC-002).
 */
export function EmployeeProfileScreen({
  employeeId,
}: {
  readonly employeeId: string;
}): ReactNode {
  const { t } = useTranslation();
  const { user } = useSession();

  const profile = useQuery<EmployeeProfile>({
    queryKey: ['employee', employeeId],
    queryFn: () => fetchEmployee(employeeId),
  });

  const canManage = hasPermission(user, Permission.HR_EMPLOYEE_UPDATE);
  const canChangeStatus = hasPermission(user, Permission.HR_EMPLOYEE_CHANGE_STATUS);
  const canReadOrganization = hasPermission(user, Permission.HR_ORGANIZATION_READ);

  const organization = useQuery<OrganizationOverview>({
    queryKey: ['organization'],
    queryFn: fetchOrganization,
    enabled: canReadOrganization,
    staleTime: 60_000,
  });

  const employees = useQuery<EmployeeSearchResult>({
    queryKey: ['employees', 'manager-options'],
    queryFn: () => fetchEmployees({ limit: 100 }),
    enabled: canManage,
    staleTime: 60_000,
  });

  const refetchAll = (): void => {
    void profile.refetch();
    if (canReadOrganization) void organization.refetch();
    if (canManage) void employees.refetch();
  };

  if (profile.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (profile.isError) {
    if (profile.error instanceof ApiError && profile.error.isForbidden) {
      return <Alert tone="danger" title={t('hr.profile.unavailable')} />;
    }
    return <ErrorAlert error={profile.error} onRetry={() => void profile.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={<Localized value={profile.data.summary.displayName} />}
        description={t('hr.profile.overview')}
        actions={
          <Link className="hos-button hos-button-secondary" to="/employees">
            {t('hr.profile.back')}
          </Link>
        }
      />
      <EmployeeProfileView
        profile={profile.data}
        organization={canReadOrganization ? organization.data : undefined}
        employees={canManage ? employees.data : undefined}
        canManage={canManage}
        canChangeStatus={canChangeStatus}
        onChanged={refetchAll}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { EmployeeSearchResult, OrganizationOverview } from '@h-os/contracts';
import { EMPLOYMENT_STATUSES, Permission } from '@h-os/contracts';
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
} from '@h-os/ui';
import { hasPermission, useSession } from '@h-os/web-client';
import { fetchEmployees } from '../api/employees.js';
import { fetchOrganization } from '../api/organization.js';
import { ErrorAlert } from '../components/error-alert.js';
import { Localized } from '../components/localized.js';
import { StatusBadge } from '../components/status-badge.js';

interface Filters {
  readonly q: string;
  readonly status: string;
  readonly branchId: string;
  readonly orgUnitId: string;
  readonly jobTitleId: string;
  readonly workLocationId: string;
}

const EMPTY_FILTERS: Filters = {
  q: '',
  status: '',
  branchId: '',
  orgUnitId: '',
  jobTitleId: '',
  workLocationId: '',
};

/**
 * Employee directory. Search, filters and pagination all run on the server; the client never
 * receives more than one bounded page (PERF-003, HHR-UX-005). Sensitive identifiers are absent
 * from this payload by construction.
 */
export function EmployeesListScreen(): ReactNode {
  const { t } = useTranslation();
  const { user } = useSession();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cursors, setCursors] = useState<readonly string[]>([]);
  const cursor = cursors[cursors.length - 1];

  const canCreate = hasPermission(user, Permission.HR_EMPLOYEE_CREATE);
  const canReadOrganization = hasPermission(user, Permission.HR_ORGANIZATION_READ);

  const organization = useQuery<OrganizationOverview>({
    queryKey: ['organization'],
    queryFn: fetchOrganization,
    enabled: canReadOrganization,
    staleTime: 60_000,
  });

  const query = useQuery<EmployeeSearchResult>({
    queryKey: ['employees', filters, cursor],
    queryFn: () =>
      fetchEmployees({
        q: filters.q.trim() || undefined,
        status: filters.status || undefined,
        branchId: filters.branchId || undefined,
        orgUnitId: filters.orgUnitId || undefined,
        jobTitleId: filters.jobTitleId || undefined,
        workLocationId: filters.workLocationId || undefined,
        cursor,
        limit: 25,
      }),
  });

  const items = query.data?.items ?? [];
  const filtered = useMemo(
    () =>
      Object.values(filters).some((value) => value.trim().length > 0),
    [filters],
  );

  function update(patch: Partial<Filters>): void {
    setFilters((current) => ({ ...current, ...patch }));
    setCursors([]);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('hr.employees.list.title')}
        description={t('hr.employees.list.subtitle')}
        actions={
          canCreate ? (
            <Link className="hos-button hos-button-primary" to="/employees/new">
              {t('hr.employees.list.create')}
            </Link>
          ) : null
        }
      />

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setCursors([]);
            void query.refetch();
          }}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('hr.employees.list.searchLabel')}>
              {(props) => (
                <Input
                  {...props}
                  type="search"
                  value={filters.q}
                  placeholder={t('hr.employees.list.searchPlaceholder')}
                  onChange={(event) => update({ q: event.target.value })}
                />
              )}
            </Field>
            <Field label={t('hr.employees.list.statusLabel')}>
              {(props) => (
                <Select
                  {...props}
                  value={filters.status}
                  onChange={(event) => update({ status: event.target.value })}
                >
                  <option value="">{t('hr.employees.list.allStatuses')}</option>
                  {EMPLOYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`status.${status}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" variant="secondary">
                {t('common.search')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setCursors([]);
                }}
              >
                {t('common.reset')}
              </Button>
              <Button
                variant="ghost"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((value) => !value)}
              >
                {t('hr.employees.list.advanced')}
              </Button>
            </div>
          </div>

          {showAdvanced ? (
            <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label={t('hr.employees.list.branch')}>
                {(props) => (
                  <Select
                    {...props}
                    value={filters.branchId}
                    onChange={(event) => update({ branchId: event.target.value })}
                    disabled={!canReadOrganization}
                  >
                    <option value="">{t('common.all')}</option>
                    {(organization.data?.branches ?? []).map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        <Localized value={branch.name} />
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('hr.employees.list.unit')}>
                {(props) => (
                  <Select
                    {...props}
                    value={filters.orgUnitId}
                    onChange={(event) => update({ orgUnitId: event.target.value })}
                    disabled={!canReadOrganization}
                  >
                    <option value="">{t('common.all')}</option>
                    {(organization.data?.orgUnits ?? [])
                      .filter(
                        (unit) => !filters.branchId || unit.branchId === filters.branchId,
                      )
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          <Localized value={unit.name} />
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <Field label={t('hr.employees.list.jobTitle')}>
                {(props) => (
                  <Select
                    {...props}
                    value={filters.jobTitleId}
                    onChange={(event) => update({ jobTitleId: event.target.value })}
                    disabled={!canReadOrganization}
                  >
                    <option value="">{t('common.all')}</option>
                    {(organization.data?.jobTitles ?? []).map((title) => (
                      <option key={title.id} value={title.id}>
                        <Localized value={title.name} />
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={t('hr.employees.list.location')}>
                {(props) => (
                  <Select
                    {...props}
                    value={filters.workLocationId}
                    onChange={(event) => update({ workLocationId: event.target.value })}
                    disabled={!canReadOrganization}
                  >
                    <option value="">{t('common.all')}</option>
                    {(organization.data?.locations ?? [])
                      .filter(
                        (location) =>
                          !filters.branchId || location.branchId === filters.branchId,
                      )
                      .map((location) => (
                        <option key={location.id} value={location.id}>
                          <Localized value={location.name} />
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
            </div>
          ) : null}
        </form>
      </Card>

      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(filtered ? 'hr.employees.list.noResultsTitle' : 'hr.employees.list.emptyTitle')}
          description={t(
            filtered ? 'hr.employees.list.noResultsBody' : 'hr.employees.list.emptyBody',
          )}
          action={
            canCreate && !filtered ? (
              <Link className="hos-button hos-button-primary" to="/employees/new">
                {t('hr.employees.list.create')}
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {t('hr.employees.list.itemCount', { count: items.length })}
          </p>

          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('hr.employees.list.columnNumber')}</th>
                  <th scope="col">{t('hr.employees.list.columnName')}</th>
                  <th scope="col">{t('hr.employees.list.columnStatus')}</th>
                  <th scope="col">{t('hr.employees.list.columnEmail')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('hr.employees.list.columnActions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-mono text-xs">{employee.employeeNumber}</td>
                    <td>
                      <Link
                        className="hos-link"
                        to="/employees/$employeeId"
                        params={{ employeeId: employee.id }}
                      >
                        <Localized value={employee.displayName} />
                      </Link>
                    </td>
                    <td>
                      <StatusBadge status={employee.status} />
                    </td>
                    <td className="text-xs">{employee.workEmail}</td>
                    <td className="text-end">
                      <Link
                        className="hos-link text-sm"
                        to="/employees/$employeeId"
                        params={{ employeeId: employee.id }}
                      >
                        {t('hr.employees.list.view')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {items.map((employee) => (
              <li key={employee.id}>
                <Link
                  className="hos-card block p-4 no-underline"
                  to="/employees/$employeeId"
                  params={{ employeeId: employee.id }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink-strong">
                        <Localized value={employee.displayName} />
                      </p>
                      <p className="font-mono text-xs text-ink-muted">{employee.employeeNumber}</p>
                      <p className="mt-1 truncate text-sm text-ink-muted">{employee.workEmail}</p>
                    </div>
                    <StatusBadge status={employee.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={cursors.length === 0}
                onClick={() => setCursors((current) => current.slice(0, -1))}
              >
                {t('common.previous')}
              </Button>
              <span className="text-sm text-ink-muted">
                {t('hr.employees.list.page', { page: cursors.length + 1 })}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!query.data?.nextCursor}
                onClick={() => {
                  const next = query.data?.nextCursor;
                  if (next) setCursors((current) => [...current, next]);
                }}
              >
                {t('common.next')}
              </Button>
            </div>
            {!query.data?.nextCursor ? (
              <span className="text-xs text-ink-muted">{t('hr.employees.list.endOfList')}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

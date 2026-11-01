import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  CreateBranch,
  CreateJobGrade,
  CreateJobTitle,
  CreateOrgUnit,
  CreateWorkLocation,
  CreateWorkSchedule,
  OrganizationOverview,
  WorkScheduleDay,
} from '@h-os/contracts';
import { ORG_UNIT_KINDS, Permission } from '@h-os/contracts';
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
import {
  createBranch,
  createJobGrade,
  createJobTitle,
  createOrgUnit,
  createWorkLocation,
  createWorkSchedule,
  fetchOrganization,
} from '../api/organization.js';
import { ErrorAlert } from '../components/error-alert.js';
import { useLocalize } from '../components/localized.js';

type Tab = 'branches' | 'locations' | 'units' | 'titles' | 'grades' | 'schedules';

const TABS: readonly Tab[] = ['branches', 'locations', 'units', 'titles', 'grades', 'schedules'];

const ADD_LABEL: Readonly<Record<Tab, string>> = {
  branches: 'hr.organization.add.branch',
  locations: 'hr.organization.add.location',
  units: 'hr.organization.add.unit',
  titles: 'hr.organization.add.title',
  grades: 'hr.organization.add.grade',
  schedules: 'hr.organization.add.schedule',
};

const DEFAULT_TIME_ZONE = 'UTC';

function defaultDays(): DayState[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    isRestDay: weekday === 0 || weekday === 6,
    startLocal: '09:00',
    endLocal: '17:00',
    breakMinutes: '60',
    crossesMidnight: false,
  }));
}

interface DayState {
  weekday: number;
  isRestDay: boolean;
  startLocal: string;
  endLocal: string;
  breakMinutes: string;
  crossesMidnight: boolean;
}

/** Shared create-panel shell: a card with a close action, used by all six tabs. */
function Panel({
  title,
  children,
  onClose,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <Card
      title={title}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {children}
    </Card>
  );
}

function useInvalidateOrganization(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['organization'] });
  };
}

function BranchForm({ onClose }: { readonly onClose: () => void }): ReactNode {
  const { t } = useTranslation();
  const invalidate = useInvalidateOrganization();
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const mutation = useMutation({
    mutationFn: (input: CreateBranch) => createBranch(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Panel title={t('hr.organization.add.branch')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
            timeZone: timeZone.trim(),
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.timeZone')}>
            {(props) => (
              <Input
                {...props}
                required
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function LocationForm({
  organization,
  onClose,
}: {
  readonly organization: OrganizationOverview;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const invalidate = useInvalidateOrganization();
  const [branchId, setBranchId] = useState(organization.branches[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const mutation = useMutation({
    mutationFn: (input: CreateWorkLocation) => createWorkLocation(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Panel title={t('hr.organization.add.location')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            branchId,
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
            addressLine: addressLine.trim().length > 0 ? addressLine.trim() : null,
            timeZone: timeZone.trim(),
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.branch')}>
            {(props) => (
              <Select
                {...props}
                required
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
              >
                {organization.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.address')}>
            {(props) => (
              <Input
                {...props}
                value={addressLine}
                onChange={(event) => setAddressLine(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.timeZone')}>
            {(props) => (
              <Input
                {...props}
                required
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending || !branchId}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function OrgUnitForm({
  organization,
  onClose,
}: {
  readonly organization: OrganizationOverview;
  readonly onClose: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const localize = useLocalize();
  const invalidate = useInvalidateOrganization();
  const [branchId, setBranchId] = useState(organization.branches[0]?.id ?? '');
  const [parentId, setParentId] = useState('');
  const [kind, setKind] = useState<string>('department');
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const mutation = useMutation({
    mutationFn: (input: CreateOrgUnit) => createOrgUnit(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const parents = organization.orgUnits.filter(
    (unit) => !branchId || unit.branchId === branchId,
  );

  return (
    <Panel title={t('hr.organization.add.unit')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            branchId,
            parentId: parentId.length > 0 ? parentId : null,
            kind: kind as CreateOrgUnit['kind'],
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.branch')}>
            {(props) => (
              <Select
                {...props}
                required
                value={branchId}
                onChange={(event) => {
                  setBranchId(event.target.value);
                  setParentId('');
                }}
              >
                {organization.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('hr.organization.form.parent')}>
            {(props) => (
              <Select
                {...props}
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">{t('hr.organization.form.parentRoot')}</option>
                {parents.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {localize(unit.name)} ({unit.path})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('hr.organization.form.kind')}>
            {(props) => (
              <Select
                {...props}
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {ORG_UNIT_KINDS.map((unitKind) => (
                  <option key={unitKind} value={unitKind}>
                    {t(`orgUnitKind.${unitKind}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending || !branchId}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function JobTitleForm({ onClose }: { readonly onClose: () => void }): ReactNode {
  const { t } = useTranslation();
  const invalidate = useInvalidateOrganization();
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const mutation = useMutation({
    mutationFn: (input: CreateJobTitle) => createJobTitle(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Panel title={t('hr.organization.add.title')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function JobGradeForm({ onClose }: { readonly onClose: () => void }): ReactNode {
  const { t } = useTranslation();
  const invalidate = useInvalidateOrganization();
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [rank, setRank] = useState('0');
  const mutation = useMutation({
    mutationFn: (input: CreateJobGrade) => createJobGrade(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <Panel title={t('hr.organization.add.grade')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate({
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
            rank: Number(rank),
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.rank')}>
            {(props) => (
              <Input
                {...props}
                type="number"
                min={0}
                max={999}
                required
                value={rank}
                onChange={(event) => setRank(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function WorkScheduleForm({ onClose }: { readonly onClose: () => void }): ReactNode {
  const { t } = useTranslation();
  const invalidate = useInvalidateOrganization();
  const [code, setCode] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
  const [days, setDays] = useState<DayState[]>(defaultDays);
  const mutation = useMutation({
    mutationFn: (input: CreateWorkSchedule) => createWorkSchedule(input),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  function updateDay(weekday: number, patch: Partial<DayState>): void {
    setDays((current) =>
      current.map((day) => (day.weekday === weekday ? { ...day, ...patch } : day)),
    );
  }

  return (
    <Panel title={t('hr.organization.add.schedule')} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const payloadDays: WorkScheduleDay[] = days.map((day) => ({
            weekday: day.weekday,
            isRestDay: day.isRestDay,
            startLocal: day.isRestDay ? null : day.startLocal,
            endLocal: day.isRestDay ? null : day.endLocal,
            breakMinutes: Number(day.breakMinutes) || 0,
            crossesMidnight: day.crossesMidnight,
          }));
          mutation.mutate({
            code: code.trim().toUpperCase(),
            name: { en: nameEn.trim(), ar: nameAr.trim() },
            timeZone: timeZone.trim(),
            days: payloadDays,
          });
        }}
      >
        {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('hr.organization.form.code')} hint={t('hr.organization.form.codeHint')}>
            {(props) => (
              <Input
                {...props}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.timeZone')}>
            {(props) => (
              <Input
                {...props}
                required
                value={timeZone}
                onChange={(event) => setTimeZone(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameEn')}>
            {(props) => (
              <Input
                {...props}
                required
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
              />
            )}
          </Field>
          <Field label={t('hr.organization.form.nameAr')}>
            {(props) => (
              <Input
                {...props}
                required
                dir="rtl"
                value={nameAr}
                onChange={(event) => setNameAr(event.target.value)}
              />
            )}
          </Field>
        </div>

        <p className="hos-help">{t('hr.organization.schedule.hint')}</p>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t('hr.organization.schedule.day')}</th>
              <th scope="col">{t('hr.organization.schedule.restDay')}</th>
              <th scope="col">{t('hr.organization.schedule.start')}</th>
              <th scope="col">{t('hr.organization.schedule.end')}</th>
              <th scope="col">{t('hr.organization.schedule.breakMinutes')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.weekday}>
                <td className="font-medium whitespace-nowrap">{t(`weekday.${day.weekday}`)}</td>
                <td>
                  <input
                    type="checkbox"
                    className="size-4 accent-accent-strong"
                    checked={day.isRestDay}
                    aria-label={`${t('hr.organization.schedule.restDay')} — ${t(`weekday.${day.weekday}`)}`}
                    onChange={(event) => updateDay(day.weekday, { isRestDay: event.target.checked })}
                  />
                </td>
                <td>
                  <Input
                    type="time"
                    value={day.startLocal}
                    disabled={day.isRestDay}
                    aria-label={`${t('hr.organization.schedule.start')} — ${t(`weekday.${day.weekday}`)}`}
                    onChange={(event) => updateDay(day.weekday, { startLocal: event.target.value })}
                  />
                </td>
                <td>
                  <Input
                    type="time"
                    value={day.endLocal}
                    disabled={day.isRestDay}
                    aria-label={`${t('hr.organization.schedule.end')} — ${t(`weekday.${day.weekday}`)}`}
                    onChange={(event) => updateDay(day.weekday, { endLocal: event.target.value })}
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    min={0}
                    max={720}
                    value={day.breakMinutes}
                    aria-label={`${t('hr.organization.schedule.breakMinutes')} — ${t(`weekday.${day.weekday}`)}`}
                    onChange={(event) =>
                      updateDay(day.weekday, { breakMinutes: event.target.value })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('common.saving') : t('hr.organization.form.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/**
 * Organization structure. Every tab reads from one overview query and writes through a dedicated
 * endpoint; the server re-checks `hr.organization.manage` with the caller's data scope on each
 * create, so the hidden buttons are convenience only (SEC-002, UX-002).
 */
export function OrganizationScreen(): ReactNode {
  const { t } = useTranslation();
  const localize = useLocalize();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('branches');
  const [openForm, setOpenForm] = useState<Tab | null>(null);

  const canManage = hasPermission(user, Permission.HR_ORGANIZATION_MANAGE);
  const query = useQuery<OrganizationOverview>({
    queryKey: ['organization'],
    queryFn: fetchOrganization,
    staleTime: 60_000,
  });

  const close = (): void => setOpenForm(null);

  function form(): ReactNode {
    if (!openForm || !query.data) return null;
    switch (openForm) {
      case 'branches':
        return <BranchForm onClose={close} />;
      case 'locations':
        return <LocationForm organization={query.data} onClose={close} />;
      case 'units':
        return <OrgUnitForm organization={query.data} onClose={close} />;
      case 'titles':
        return <JobTitleForm onClose={close} />;
      case 'grades':
        return <JobGradeForm onClose={close} />;
      case 'schedules':
        return <WorkScheduleForm onClose={close} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('hr.organization.title')}
        description={t('hr.organization.subtitle')}
        actions={
          canManage ? (
            <Button
              onClick={() => setOpenForm(openForm === tab ? null : tab)}
              aria-expanded={openForm === tab}
            >
              {t(ADD_LABEL[tab])}
            </Button>
          ) : null
        }
      />

      <div role="tablist" aria-label={t('hr.organization.title')} className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            aria-controls={`org-panel-${item}`}
            id={`org-tab-${item}`}
            className="hos-tab"
            onClick={() => {
              setTab(item);
              setOpenForm(null);
            }}
          >
            {t(`hr.organization.tabs.${item}`)}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : query.isError ? (
        <ErrorAlert error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          {form()}

          <div role="tabpanel" id={`org-panel-${tab}`} aria-labelledby={`org-tab-${tab}`}>
            {tab === 'branches' ? (
              query.data.branches.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.branches')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                      <th scope="col">{t('hr.organization.table.timeZone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.branches.map((branch) => (
                      <tr key={branch.id}>
                        <td className="font-mono text-xs">{branch.code}</td>
                        <td>{localize(branch.name)}</td>
                        <td className="text-xs">{branch.timeZone}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : null}

            {tab === 'locations' ? (
              query.data.locations.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.locations')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                      <th scope="col">{t('hr.organization.table.branch')}</th>
                      <th scope="col">{t('hr.organization.table.address')}</th>
                      <th scope="col">{t('hr.organization.table.timeZone')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.locations.map((location) => {
                      const branch = query.data.branches.find(
                        (candidate) => candidate.id === location.branchId,
                      );
                      return (
                        <tr key={location.id}>
                          <td className="font-mono text-xs">{location.code}</td>
                          <td>{localize(location.name)}</td>
                          <td>{branch ? branch.code : '—'}</td>
                          <td className="text-xs">{location.addressLine ?? '—'}</td>
                          <td className="text-xs">{location.timeZone}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )
            ) : null}

            {tab === 'units' ? (
              query.data.orgUnits.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.units')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                      <th scope="col">{t('hr.organization.table.kind')}</th>
                      <th scope="col">{t('hr.organization.table.path')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.orgUnits.map((unit) => (
                      <tr key={unit.id}>
                        <td className="font-mono text-xs">{unit.code}</td>
                        <td>{localize(unit.name)}</td>
                        <td>{t(`orgUnitKind.${unit.kind}`)}</td>
                        <td className="font-mono text-xs">{unit.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : null}

            {tab === 'titles' ? (
              query.data.jobTitles.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.titles')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.jobTitles.map((title) => (
                      <tr key={title.id}>
                        <td className="font-mono text-xs">{title.code}</td>
                        <td>{localize(title.name)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : null}

            {tab === 'grades' ? (
              query.data.jobGrades.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.grades')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                      <th scope="col">{t('hr.organization.table.rank')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.jobGrades.map((grade) => (
                      <tr key={grade.id}>
                        <td className="font-mono text-xs">{grade.code}</td>
                        <td>{localize(grade.name)}</td>
                        <td>{grade.rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : null}

            {tab === 'schedules' ? (
              query.data.workSchedules.length === 0 ? (
                <EmptyState title={t('hr.organization.empty.schedules')} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('hr.organization.table.code')}</th>
                      <th scope="col">{t('hr.organization.table.name')}</th>
                      <th scope="col">{t('hr.organization.table.timeZone')}</th>
                      <th scope="col">{t('hr.organization.table.days')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.workSchedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td className="font-mono text-xs">{schedule.code}</td>
                        <td>{localize(schedule.name)}</td>
                        <td className="text-xs">{schedule.timeZone}</td>
                        <td className="text-xs">
                          {schedule.days
                            .filter((day) => !day.isRestDay)
                            .map((day) => t(`weekday.${day.weekday}`))
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

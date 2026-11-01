import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type {
  CreateEmployee,
  EmployeeSearchResult,
  OrganizationOverview,
} from '@h-os/contracts';
import { EMPLOYMENT_TYPES, GENDERS, WORK_ARRANGEMENTS } from '@h-os/contracts';import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from '@h-os/ui';
import { useSession } from '@h-os/web-client';
import { createEmployee, fetchEmployees } from '../api/employees.js';
import { fetchOrganization } from '../api/organization.js';
import { ErrorAlert } from '../components/error-alert.js';
import { Localized } from '../components/localized.js';

interface EmployeeFormValues {
  givenEn: string;
  familyEn: string;
  givenAr: string;
  familyAr: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalId: string;
  passportNumber: string;
  workEmail: string;
  personalEmail: string;
  phone: string;
  city: string;
  employmentType: string;
  startDate: string;
  probationEndDate: string;
  branchId: string;
  workLocationId: string;
  orgUnitId: string;
  jobTitleId: string;
  jobGradeId: string;
  workArrangement: string;
  workScheduleId: string;
  costCenterRef: string;
  managerEmployeeId: string;
  accountId: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Employee creation. The server derives the employee number and the starting status from the
 * start date; the form never sends either (HHR-EMP-001, HR-DEC-0001).
 */
export function EmployeeNewScreen(): ReactNode {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();
  const canReadEmployees = Boolean(user);

  const organization = useQuery<OrganizationOverview>({
    queryKey: ['organization'],
    queryFn: fetchOrganization,
  });
  const managers = useQuery<EmployeeSearchResult>({
    queryKey: ['employees', 'manager-options'],
    queryFn: () => fetchEmployees({ limit: 100 }),
    enabled: canReadEmployees,
  });

  const { register, handleSubmit, control, setValue, formState } = useForm<EmployeeFormValues>({
    defaultValues: {
      givenEn: '',
      familyEn: '',
      givenAr: '',
      familyAr: '',
      dateOfBirth: '',
      gender: 'undisclosed',
      nationality: '',
      nationalId: '',
      passportNumber: '',
      workEmail: '',
      personalEmail: '',
      phone: '',
      city: '',
      employmentType: 'permanent',
      startDate: today(),
      probationEndDate: '',
      branchId: '',
      workLocationId: '',
      orgUnitId: '',
      jobTitleId: '',
      jobGradeId: '',
      workArrangement: 'office',
      workScheduleId: '',
      costCenterRef: '',
      managerEmployeeId: '',
      accountId: '',
    },
  });

  const branchId = useWatch({ control, name: 'branchId' }) ?? '';

  useEffect(() => {
    const firstBranch = organization.data?.branches[0];
    if (firstBranch) setValue('branchId', firstBranch.id, { shouldValidate: true });
  }, [organization.data, setValue]);

  const mutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      const payload: CreateEmployee = {
        name: {
          givenEn: values.givenEn.trim(),
          familyEn: values.familyEn.trim(),
          givenAr: values.givenAr.trim(),
          familyAr: values.familyAr.trim(),
        },
        personal: {
          dateOfBirth: nullable(values.dateOfBirth),
          gender: values.gender as CreateEmployee['personal']['gender'],
          nationality: nullable(values.nationality),
          nationalId: nullable(values.nationalId),
          passportNumber: nullable(values.passportNumber),
        },
        contact: {
          workEmail: values.workEmail.trim(),
          personalEmail: nullable(values.personalEmail),
          phone: nullable(values.phone),
          city: nullable(values.city),
        },
        employment: {
          employmentType: values.employmentType as CreateEmployee['employment']['employmentType'],
          startDate: values.startDate,
          probationEndDate: nullable(values.probationEndDate),
          contract: null,
        },
        assignment: {
          branchId: values.branchId,
          workLocationId: values.workLocationId,
          orgUnitId: values.orgUnitId,
          jobTitleId: values.jobTitleId,
          jobGradeId: nullable(values.jobGradeId),
          workArrangement: values.workArrangement as CreateEmployee['assignment']['workArrangement'],
          workScheduleId: nullable(values.workScheduleId),
          costCenterRef: nullable(values.costCenterRef),
        },
        managerEmployeeId: nullable(values.managerEmployeeId),
        accountId: nullable(values.accountId),
      };
      return createEmployee(payload);
    },
    onSuccess: (created) => {
      void navigate({
        to: '/employees/$employeeId',
        params: { employeeId: created.employeeId },
      });
    },
  });

  const branches = organization.data?.branches ?? [];
  const locations = (organization.data?.locations ?? []).filter(
    (location) => !branchId || location.branchId === branchId,
  );
  const units = (organization.data?.orgUnits ?? []).filter(
    (unit) => !branchId || unit.branchId === branchId,
  );
  const schedules = organization.data?.workSchedules ?? [];

  const required = { required: t('common.required') };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('hr.employees.create.title')}
        description={t('hr.employees.create.subtitle')}
        actions={
          <Link className="hos-button hos-button-secondary" to="/employees">
            {t('hr.employees.create.back')}
          </Link>
        }
      />

      {organization.isError ? (
        <ErrorAlert error={organization.error} onRetry={() => void organization.refetch()} />
      ) : null}
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void handleSubmit((values) => mutation.mutate(values))(event);
        }}
      >
        <Card title={t('hr.employees.create.sectionName')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.givenEn')} error={formState.errors.givenEn?.message}>
              {(props) => <Input {...props} {...register('givenEn', required)} />}
            </Field>
            <Field label={t('hr.employees.create.familyEn')} error={formState.errors.familyEn?.message}>
              {(props) => <Input {...props} {...register('familyEn', required)} />}
            </Field>
            <Field label={t('hr.employees.create.givenAr')} error={formState.errors.givenAr?.message}>
              {(props) => <Input {...props} {...register('givenAr', required)} dir="rtl" />}
            </Field>
            <Field label={t('hr.employees.create.familyAr')} error={formState.errors.familyAr?.message}>
              {(props) => <Input {...props} {...register('familyAr', required)} dir="rtl" />}
            </Field>
          </div>
        </Card>

        <Card
          title={t('hr.employees.create.sectionPersonal')}
          description={t('hr.employees.create.identityHint')}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.dateOfBirth')}>
              {(props) => <Input {...props} type="date" {...register('dateOfBirth')} />}
            </Field>
            <Field label={t('hr.employees.create.gender')}>
              {(props) => (
                <Select {...props} {...register('gender')}>
                  {GENDERS.map((gender) => (
                    <option key={gender} value={gender}>
                      {t(`gender.${gender}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.nationality')}>
              {(props) => <Input {...props} maxLength={3} {...register('nationality')} />}
            </Field>
            <Field label={t('hr.employees.create.nationalId')}>
              {(props) => <Input {...props} inputMode="numeric" {...register('nationalId')} />}
            </Field>
            <Field label={t('hr.employees.create.passportNumber')}>
              {(props) => <Input {...props} {...register('passportNumber')} />}
            </Field>
          </div>
        </Card>

        <Card title={t('hr.employees.create.sectionContact')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.workEmail')} error={formState.errors.workEmail?.message}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  {...register('workEmail', {
                    required: t('common.required'),
                    pattern: { value: /.+@.+\..+/, message: t('errors.invalidEmail') },
                  })}
                />
              )}
            </Field>
            <Field label={t('hr.employees.create.personalEmail')}>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  {...register('personalEmail', {
                    pattern: { value: /.+@.+\..+/, message: t('errors.invalidEmail') },
                  })}
                />
              )}
            </Field>
            <Field label={t('hr.employees.create.phone')}>
              {(props) => <Input {...props} type="tel" {...register('phone')} />}
            </Field>
            <Field label={t('hr.employees.create.city')}>
              {(props) => <Input {...props} {...register('city')} />}
            </Field>
          </div>
        </Card>

        <Card title={t('hr.employees.create.sectionEmployment')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.employmentType')}>
              {(props) => (
                <Select {...props} {...register('employmentType')}>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`employmentType.${type}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('hr.employees.create.startDate')}
              error={formState.errors.startDate?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  {...register('startDate', {
                    required: t('common.required'),
                    pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: t('errors.invalidDate') },
                  })}
                />
              )}
            </Field>
            <Field label={t('hr.employees.create.probationEndDate')}>
              {(props) => <Input {...props} type="date" {...register('probationEndDate')} />}
            </Field>
          </div>
        </Card>

        <Card title={t('hr.employees.create.sectionAssignment')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.branch')} error={formState.errors.branchId?.message}>
              {(props) => (
                <Select
                  {...props}
                  {...register('branchId', required)}
                  onChange={(event) => {
                    setValue('branchId', event.target.value);
                    setValue('workLocationId', '');
                    setValue('orgUnitId', '');
                  }}
                >
                  <option value="">{t('common.none')}</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      <Localized value={branch.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('hr.employees.create.workLocation')}
              error={formState.errors.workLocationId?.message}
            >
              {(props) => (
                <Select {...props} {...register('workLocationId', required)}>
                  <option value="">{t('common.none')}</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      <Localized value={location.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.orgUnit')} error={formState.errors.orgUnitId?.message}>
              {(props) => (
                <Select {...props} {...register('orgUnitId', required)}>
                  <option value="">{t('common.none')}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      <Localized value={unit.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.jobTitle')} error={formState.errors.jobTitleId?.message}>
              {(props) => (
                <Select {...props} {...register('jobTitleId', required)}>
                  <option value="">{t('common.none')}</option>
                  {(organization.data?.jobTitles ?? []).map((title) => (
                    <option key={title.id} value={title.id}>
                      <Localized value={title.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.jobGrade')}>
              {(props) => (
                <Select {...props} {...register('jobGradeId')}>
                  <option value="">{t('common.none')}</option>
                  {(organization.data?.jobGrades ?? []).map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      <Localized value={grade.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.workArrangement')}>
              {(props) => (
                <Select {...props} {...register('workArrangement')}>
                  {WORK_ARRANGEMENTS.map((arrangement) => (
                    <option key={arrangement} value={arrangement}>
                      {t(`workArrangement.${arrangement}`)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.workSchedule')}>
              {(props) => (
                <Select {...props} {...register('workScheduleId')}>
                  <option value="">{t('common.none')}</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      <Localized value={schedule.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.employees.create.costCenter')}>
              {(props) => <Input {...props} {...register('costCenterRef')} />}
            </Field>
          </div>
        </Card>

        <Card title={t('hr.employees.create.sectionLinks')}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.employees.create.manager')}>
              {(props) => (
                <Select {...props} {...register('managerEmployeeId')}>
                  <option value="">{t('common.none')}</option>
                  {(managers.data?.items ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.employeeNumber} — <Localized value={employee.displayName} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label={t('hr.employees.create.accountId')}
              hint={t('hr.employees.create.accountIdHint')}
            >
              {(props) => <Input {...props} {...register('accountId')} />}
            </Field>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? t('hr.employees.create.submitting')
              : t('hr.employees.create.submit')}
          </Button>
          <Link className="hos-button hos-button-secondary" to="/employees">
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </div>
  );
}

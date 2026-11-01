import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type {
  ChangeAssignment,
  ChangeEmploymentStatus,
  ChangeManager,
  EmployeeProfile,
  EmployeeSearchResult,
  OrganizationOverview,
} from '@h-os/contracts';
import {
  EMPLOYMENT_STATUSES,
  WORK_ARRANGEMENTS,
} from '@h-os/contracts';
import { Alert, Button, Field, Input, Select } from '@h-os/ui';
import {
  addDocumentReference,
  addEmergencyContact,
  changeAssignment,
  changeEmploymentStatus,
  changeManager,
  updateEmployee,
} from '../api/employees.js';
import { ErrorAlert } from './error-alert.js';
import { Localized } from './localized.js';

export interface FormProps {
  readonly profile: EmployeeProfile;
  readonly onDone: () => void;
  readonly onCancel: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const END_STATUSES = new Set(['terminated', 'retired', 'cancelled']);

/** One legal lifecycle transition, with the end reason required by the domain (HR-DEC-0001). */
export function StatusForm({ profile, onDone, onCancel }: FormProps): ReactNode {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: (input: ChangeEmploymentStatus) =>
      changeEmploymentStatus(profile.summary.id, input),
    onSuccess: onDone,
  });
  const { register, handleSubmit, control, formState } = useForm({
    defaultValues: {
      toStatus: '',
      effectiveDate: today(),
      reason: '',
      endReason: '',
    },
  });
  const toStatus = useWatch({ control, name: 'toStatus' }) ?? '';
  const requiresEndReason = END_STATUSES.has(toStatus);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate({
            toStatus: values.toStatus as ChangeEmploymentStatus['toStatus'],
            effectiveDate: values.effectiveDate,
            reason: values.reason.trim(),
            endReason: requiresEndReason ? nullable(values.endReason) : null,
          });
        })(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('hr.forms.status.toStatus')} error={formState.errors.toStatus?.message}>
          {(props) => (
            <Select {...props} {...register('toStatus', { required: t('common.required') })}>
              <option value="">{t('common.none')}</option>
              {EMPLOYMENT_STATUSES.filter((status) => status !== profile.summary.status).map(
                (status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ),
              )}
            </Select>
          )}
        </Field>
        <Field
          label={t('hr.forms.status.effectiveDate')}
          error={formState.errors.effectiveDate?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              {...register('effectiveDate', { required: t('common.required') })}
            />
          )}
        </Field>
        {requiresEndReason ? (
          <Field
            label={t('hr.forms.status.endReason')}
            hint={t('hr.forms.status.endReasonHint')}
            error={formState.errors.endReason?.message}
          >
            {(props) => (
              <Input {...props} {...register('endReason', { required: t('common.required') })} />
            )}
          </Field>
        ) : null}
        <Field label={t('hr.forms.status.reason')} error={formState.errors.reason?.message}>
          {(props) => (
            <Input
              {...props}
              {...register('reason', {
                required: t('common.required'),
                minLength: { value: 3, message: t('errors.tooShort') },
              })}
            />
          )}
        </Field>
      </div>
      <p className="hos-help">{t('hr.forms.status.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.status.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function AssignmentForm({
  profile,
  organization,
  onDone,
  onCancel,
}: FormProps & { readonly organization: OrganizationOverview | undefined }): ReactNode {
  const { t } = useTranslation();
  const current = profile.organization.currentAssignment;
  const mutation = useMutation({
    mutationFn: (input: ChangeAssignment) => changeAssignment(profile.summary.id, input),
    onSuccess: onDone,
  });
  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      orgUnitId: current?.orgUnitId ?? '',
      workLocationId: current?.workLocationId ?? '',
      jobTitleId: current?.jobTitleId ?? '',
      jobGradeId: current?.jobGradeId ?? '',
      workArrangement: current?.workArrangement ?? 'office',
      workScheduleId: current?.workScheduleId ?? '',
      costCenterRef: current?.costCenterRef ?? '',
      effectiveFrom: today(),
      reason: '',
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate({
            orgUnitId: values.orgUnitId,
            workLocationId: values.workLocationId,
            jobTitleId: values.jobTitleId,
            jobGradeId: nullable(values.jobGradeId),
            workArrangement: values.workArrangement as ChangeAssignment['workArrangement'],
            workScheduleId: nullable(values.workScheduleId),
            costCenterRef: nullable(values.costCenterRef),
            effectiveFrom: values.effectiveFrom,
            reason: values.reason.trim(),
          });
        })(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      {!organization ? (
        <Alert tone="warning">{t('errors.forbidden')}</Alert>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('hr.profile.orgUnit')} error={formState.errors.orgUnitId?.message}>
              {(props) => (
                <Select {...props} {...register('orgUnitId', { required: t('common.required') })}>
                  {organization.orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      <Localized value={unit.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.profile.location')} error={formState.errors.workLocationId?.message}>
              {(props) => (
                <Select
                  {...props}
                  {...register('workLocationId', { required: t('common.required') })}
                >
                  {organization.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      <Localized value={location.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.profile.jobTitle')} error={formState.errors.jobTitleId?.message}>
              {(props) => (
                <Select {...props} {...register('jobTitleId', { required: t('common.required') })}>
                  {organization.jobTitles.map((title) => (
                    <option key={title.id} value={title.id}>
                      <Localized value={title.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.profile.jobGrade')}>
              {(props) => (
                <Select {...props} {...register('jobGradeId')}>
                  <option value="">{t('common.none')}</option>
                  {organization.jobGrades.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      <Localized value={grade.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.profile.workArrangement')}>
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
            <Field label={t('hr.profile.workSchedule')}>
              {(props) => (
                <Select {...props} {...register('workScheduleId')}>
                  <option value="">{t('common.none')}</option>
                  {organization.workSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      <Localized value={schedule.name} />
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('hr.profile.costCenter')}>
              {(props) => <Input {...props} {...register('costCenterRef')} />}
            </Field>
            <Field
              label={t('hr.forms.assignment.effectiveFrom')}
              error={formState.errors.effectiveFrom?.message}
            >
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  {...register('effectiveFrom', { required: t('common.required') })}
                />
              )}
            </Field>
            <Field label={t('common.reason')} error={formState.errors.reason?.message}>
              {(props) => (
                <Input
                  {...props}
                  {...register('reason', {
                    required: t('common.required'),
                    minLength: { value: 3, message: t('errors.tooShort') },
                  })}
                />
              )}
            </Field>
          </div>
          <p className="hos-help">{t('hr.forms.assignment.hint')}</p>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending || !organization}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.assignment.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function ManagerForm({
  profile,
  employees,
  onDone,
  onCancel,
}: FormProps & { readonly employees: EmployeeSearchResult | undefined }): ReactNode {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: (input: ChangeManager) => changeManager(profile.summary.id, input),
    onSuccess: onDone,
  });
  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      managerEmployeeId: profile.organization.currentManager?.employeeId ?? '',
      effectiveFrom: today(),
      reason: '',
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate({
            managerEmployeeId: nullable(values.managerEmployeeId),
            effectiveFrom: values.effectiveFrom,
            reason: values.reason.trim(),
          });
        })(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('hr.forms.manager.manager')}>
          {(props) => (
            <Select {...props} {...register('managerEmployeeId')}>
              <option value="">{t('hr.forms.manager.noManager')}</option>
              {(employees?.items ?? [])
                .filter((employee) => employee.id !== profile.summary.id)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeNumber} — <Localized value={employee.displayName} />
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field
          label={t('hr.forms.manager.effectiveFrom')}
          error={formState.errors.effectiveFrom?.message}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              {...register('effectiveFrom', { required: t('common.required') })}
            />
          )}
        </Field>
        <Field label={t('common.reason')} error={formState.errors.reason?.message}>
          {(props) => (
            <Input
              {...props}
              {...register('reason', {
                required: t('common.required'),
                minLength: { value: 3, message: t('errors.tooShort') },
              })}
            />
          )}
        </Field>
      </div>
      <p className="hos-help">{t('hr.forms.manager.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.manager.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function ContactForm({ profile, onDone, onCancel }: FormProps): ReactNode {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: (values: { name: string; relationship: string; phone: string; priority: number }) =>
      addEmergencyContact(profile.summary.id, values),
    onSuccess: onDone,
  });
  const { register, handleSubmit, formState } = useForm({
    defaultValues: { name: '', relationship: '', phone: '', priority: 1 },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate({
            name: values.name.trim(),
            relationship: values.relationship.trim(),
            phone: values.phone.trim(),
            priority: Number(values.priority),
          });
        })(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('hr.forms.contact.name')} error={formState.errors.name?.message}>
          {(props) => (
            <Input {...props} {...register('name', { required: t('common.required') })} />
          )}
        </Field>
        <Field
          label={t('hr.forms.contact.relationship')}
          error={formState.errors.relationship?.message}
        >
          {(props) => (
            <Input {...props} {...register('relationship', { required: t('common.required') })} />
          )}
        </Field>
        <Field label={t('hr.forms.contact.phone')} error={formState.errors.phone?.message}>
          {(props) => (
            <Input
              {...props}
              type="tel"
              {...register('phone', { required: t('common.required') })}
            />
          )}
        </Field>
        <Field label={t('hr.forms.contact.priority')}>
          {(props) => (
            <Input {...props} type="number" min={1} max={10} {...register('priority')} />
          )}
        </Field>
      </div>
      <p className="hos-help">{t('hr.forms.contact.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.contact.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function DocumentForm({ profile, onDone, onCancel }: FormProps): ReactNode {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: (values: {
      archiveDocumentId: string;
      documentType: string;
      classification: string;
      issuedOn: string | null;
      expiresOn: string | null;
    }) =>
      addDocumentReference(profile.summary.id, {
        ...values,
        classification: values.classification as 'public' | 'internal' | 'confidential' | 'restricted',
      }),
    onSuccess: onDone,
  });
  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      archiveDocumentId: '',
      documentType: 'contract',
      classification: 'confidential',
      issuedOn: '',
      expiresOn: '',
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => {
          mutation.mutate({
            archiveDocumentId: values.archiveDocumentId.trim(),
            documentType: values.documentType,
            classification: values.classification,
            issuedOn: nullable(values.issuedOn),
            expiresOn: nullable(values.expiresOn),
          });
        })(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label={t('hr.forms.document.archiveDocumentId')}
          error={formState.errors.archiveDocumentId?.message}
        >
          {(props) => (
            <Input
              {...props}
              {...register('archiveDocumentId', { required: t('common.required') })}
            />
          )}
        </Field>
        <Field label={t('hr.forms.document.documentType')}>
          {(props) => (
            <Select {...props} {...register('documentType')}>
              {['contract', 'national_id', 'passport', 'certificate', 'other'].map((type) => (
                <option key={type} value={type}>
                  {t(`documentType.${type}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('hr.forms.document.classification')}>
          {(props) => (
            <Select {...props} {...register('classification')}>
              {['public', 'internal', 'confidential', 'restricted'].map((level) => (
                <option key={level} value={level}>
                  {t(`classification.${level}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('hr.forms.document.issuedOn')}>
          {(props) => <Input {...props} type="date" {...register('issuedOn')} />}
        </Field>
        <Field label={t('hr.forms.document.expiresOn')}>
          {(props) => <Input {...props} type="date" {...register('expiresOn')} />}
        </Field>
      </div>
      <p className="hos-help">{t('hr.forms.document.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.document.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export function EditForm({ profile, onDone, onCancel }: FormProps): ReactNode {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: (values: { workEmail: string; city: string }) =>
      updateEmployee(profile.summary.id, {
        workEmail: values.workEmail.trim(),
        city: nullable(values.city),
      }),
    onSuccess: onDone,
  });
  const { register, handleSubmit, formState } = useForm({
    defaultValues: {
      workEmail: profile.summary.workEmail,
      city: profile.contact?.city ?? '',
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void handleSubmit((values) => mutation.mutate(values))(event);
      }}
    >
      {mutation.isError ? <ErrorAlert error={mutation.error} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t('hr.forms.edit.workEmail')} error={formState.errors.workEmail?.message}>
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
        <Field label={t('hr.forms.edit.city')}>
          {(props) => <Input {...props} {...register('city')} />}
        </Field>
      </div>
      <p className="hos-help">{t('hr.forms.edit.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('common.saving') : t('hr.forms.edit.submit')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

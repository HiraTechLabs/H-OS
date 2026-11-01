import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  EmployeeProfile,
  EmployeeSearchResult,
  OrganizationOverview,
  ProfileSection,
} from '@h-os/contracts';
import { Alert, Badge, Button, Card, EmptyState, Table } from '@h-os/ui';
import { formatDate } from '@h-os/web-client';
import {
  AssignmentForm,
  ContactForm,
  DocumentForm,
  EditForm,
  ManagerForm,
  StatusForm,
} from './employee-action-forms.js';
import { Localized, useLocale } from './localized.js';
import { StatusBadge } from './status-badge.js';

type Panel = 'edit' | 'status' | 'assignment' | 'manager' | 'contact' | 'document' | null;

export interface ProfileViewProps {
  readonly profile: EmployeeProfile;
  readonly organization?: OrganizationOverview;
  readonly employees?: EmployeeSearchResult;
  readonly canManage: boolean;
  readonly canChangeStatus: boolean;
  readonly onChanged: () => void;
}

function Detail({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="text-sm text-ink-strong">{children}</dd>
    </div>
  );
}

function has(sections: readonly ProfileSection[], section: ProfileSection): boolean {
  return sections.includes(section);
}

/**
 * The profile body shared by the HR view and self-service. Sections the caller may not see are
 * replaced by an explicit restricted notice, and mutation buttons are hidden without the
 * corresponding permission (HHR-UX-002, HHR-UX-004).
 */
export function EmployeeProfileView({
  profile,
  organization,
  employees,
  canManage,
  canChangeStatus,
  onChanged,
}: ProfileViewProps): ReactNode {
  const { t } = useTranslation();
  const locale = useLocale();
  const [panel, setPanel] = useState<Panel>(null);
  const sections = profile.visibleSections;
  const summary = profile.summary;

  const close = (): void => setPanel(null);
  const changed = (): void => {
    setPanel(null);
    onChanged();
  };

  const actionPanel = (() => {
    const props = { profile, onDone: changed, onCancel: close };
    switch (panel) {
      case 'edit':
        return <EditForm {...props} />;
      case 'status':
        return <StatusForm {...props} />;
      case 'assignment':
        return <AssignmentForm {...props} organization={organization} />;
      case 'manager':
        return <ManagerForm {...props} employees={employees} />;
      case 'contact':
        return <ContactForm {...props} />;
      case 'document':
        return <DocumentForm {...props} />;
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink-muted">{summary.employeeNumber}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink-strong sm:text-2xl">
              <Localized value={summary.displayName} />
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={summary.status} />
              {summary.orgUnitName ? (
                <Badge tone="neutral">
                  <Localized value={summary.orgUnitName} />
                </Badge>
              ) : null}
              {summary.jobTitleName ? (
                <Badge tone="accent">
                  <Localized value={summary.jobTitleName} />
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'edit' ? null : 'edit')}
              >
                {t('hr.profile.action.edit')}
              </Button>
            ) : null}
            {canChangeStatus ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'status' ? null : 'status')}
              >
                {t('hr.profile.action.status')}
              </Button>
            ) : null}
            {canManage && organization ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'assignment' ? null : 'assignment')}
              >
                {t('hr.profile.action.assignment')}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'manager' ? null : 'manager')}
              >
                {t('hr.profile.action.manager')}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'contact' ? null : 'contact')}
              >
                {t('hr.profile.action.contact')}
              </Button>
            ) : null}
            {canManage ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPanel(panel === 'document' ? null : 'document')}
              >
                {t('hr.profile.action.document')}
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label={t('hr.profile.workEmail')}>{summary.workEmail}</Detail>
          <Detail label={t('hr.profile.branch')}>
            {summary.branchName ? <Localized value={summary.branchName} /> : t('common.notProvided')}
          </Detail>
          <Detail label={t('hr.profile.location')}>
            {summary.workLocationName ? (
              <Localized value={summary.workLocationName} />
            ) : (
              t('common.notProvided')
            )}
          </Detail>
          <Detail label={t('hr.profile.currentManager')}>
            {summary.managerDisplayName ? (
              <Localized value={summary.managerDisplayName} />
            ) : (
              t('hr.profile.noManager')
            )}
          </Detail>
        </dl>
      </Card>

      {actionPanel ? (
        <Card
          title={
            panel === 'status'
              ? t('hr.forms.status.title')
              : panel === 'assignment'
                ? t('hr.forms.assignment.title')
                : panel === 'manager'
                  ? t('hr.forms.manager.title')
                  : panel === 'contact'
                    ? t('hr.forms.contact.title')
                    : panel === 'document'
                      ? t('hr.forms.document.title')
                      : t('hr.forms.edit.title')
          }
          actions={
            <Button variant="ghost" size="sm" onClick={close}>
              {t('hr.profile.action.closePanel')}
            </Button>
          }
        >
          {actionPanel}
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t('hr.profile.identity')}>
          {!has(sections, 'identity') ? (
            <Alert tone="info">{t('hr.profile.identityRestricted')}</Alert>
          ) : !profile.identity ? (
            <Alert tone="info">{t('hr.profile.sensitiveRestricted')}</Alert>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label={t('hr.profile.nationalId')}>
                {profile.identity.nationalIdMasked ?? t('common.notProvided')}
              </Detail>
              <Detail label={t('hr.profile.passport')}>
                {profile.identity.passportMasked ?? t('common.notProvided')}
              </Detail>
              <Detail label={t('hr.profile.dateOfBirth')}>
                {formatDate(profile.identity.dateOfBirth, locale) || t('common.notProvided')}
              </Detail>
              <Detail label={t('hr.profile.gender')}>{t(`gender.${profile.identity.gender}`)}</Detail>
              <Detail label={t('hr.profile.nationality')}>
                {profile.identity.nationality ?? t('common.notProvided')}
              </Detail>
            </dl>
          )}
        </Card>

        <Card title={t('hr.profile.contact')}>
          {!has(sections, 'contact') || !profile.contact ? (
            <Alert tone="info">{t('hr.profile.sensitiveRestricted')}</Alert>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label={t('hr.profile.personalEmail')}>
                {profile.contact.personalEmail ?? t('common.notProvided')}
              </Detail>
              <Detail label={t('hr.profile.phone')}>
                {profile.contact.phone ?? t('common.notProvided')}
              </Detail>
              <Detail label={t('hr.profile.city')}>
                {profile.contact.city ?? t('common.notProvided')}
              </Detail>
            </dl>
          )}
        </Card>
      </div>

      <Card title={t('hr.profile.employment')}>
        <div className="flex flex-col gap-5">
          {profile.employment.currentEpisode ? (
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label={t('hr.profile.startDate')}>
                {formatDate(profile.employment.currentEpisode.startDate, locale)}
              </Detail>
              <Detail label={t('hr.profile.employment')}>
                {t(`employmentType.${profile.employment.currentEpisode.employmentType}`)}
              </Detail>
              <Detail label={t('hr.profile.probationEndDate')}>
                {formatDate(profile.employment.currentEpisode.probationEndDate, locale) ||
                  t('common.notProvided')}
              </Detail>
            </dl>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('hr.profile.episode')}</th>
                  <th scope="col">{t('hr.profile.startDate')}</th>
                  <th scope="col">{t('hr.profile.endDate')}</th>
                  <th scope="col">{t('hr.profile.probationEndDate')}</th>
                  <th scope="col">{t('hr.profile.endReason')}</th>
                </tr>
              </thead>
              <tbody>
                {profile.employment.episodes.map((episode) => (
                  <tr key={episode.id}>
                    <td>{t('hr.profile.episodeNo', { number: episode.episodeNo })}</td>
                    <td>{formatDate(episode.startDate, locale)}</td>
                    <td>{formatDate(episode.endDate, locale) || '—'}</td>
                    <td>{formatDate(episode.probationEndDate, locale) || '—'}</td>
                    <td>{episode.endReason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {profile.employment.contracts.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('hr.profile.contractType')}</th>
                    <th scope="col">{t('hr.profile.startDate')}</th>
                    <th scope="col">{t('hr.profile.endDate')}</th>
                    <th scope="col">{t('hr.profile.signedOn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.employment.contracts.map((contract) => (
                    <tr key={contract.id}>
                      <td>{t(`contractType.${contract.contractType}`)}</td>
                      <td>{formatDate(contract.startDate, locale)}</td>
                      <td>{formatDate(contract.endDate, locale) || '—'}</td>
                      <td>{formatDate(contract.signedOn, locale) || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">{t('hr.profile.noContract')}</p>
          )}
        </div>
      </Card>

      <Card title={t('hr.profile.organization')}>
        <div className="flex flex-col gap-5">
          {profile.organization.currentAssignment ? (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label={t('hr.profile.orgUnit')}>
                <Localized value={profile.organization.currentAssignment.orgUnitName} />
              </Detail>
              <Detail label={t('hr.profile.branch')}>
                <Localized value={profile.organization.currentAssignment.branchName} />
              </Detail>
              <Detail label={t('hr.profile.jobTitle')}>
                <Localized value={profile.organization.currentAssignment.jobTitleName} />
              </Detail>
              <Detail label={t('hr.profile.workArrangement')}>
                {t(`workArrangement.${profile.organization.currentAssignment.workArrangement}`)}
              </Detail>
              <Detail label={t('hr.profile.path')}>
                <span className="font-mono text-xs">
                  {profile.organization.currentAssignment.orgUnitPath}
                </span>
              </Detail>
              <Detail label={t('hr.profile.costCenter')}>
                {profile.organization.currentAssignment.costCenterRef ?? t('common.notProvided')}
              </Detail>
            </dl>
          ) : (
            <EmptyState title={t('hr.profile.unavailable')} />
          )}

          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('hr.profile.orgUnit')}</th>
                  <th scope="col">{t('hr.profile.jobTitle')}</th>
                  <th scope="col">{t('hr.profile.range')}</th>
                </tr>
              </thead>
              <tbody>
                {profile.organization.assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <Localized value={assignment.orgUnitName} />
                    </td>
                    <td>
                      <Localized value={assignment.jobTitleName} />
                    </td>
                    <td className="text-xs">
                      {formatDate(assignment.validFrom, locale)} →{' '}
                      {assignment.validTo
                        ? formatDate(assignment.validTo, locale)
                        : t('hr.profile.openEnded')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <Detail label={t('hr.profile.currentManager')}>
              {profile.organization.currentManager ? (
                <Localized value={profile.organization.currentManager.displayName} />
              ) : (
                t('hr.profile.noManager')
              )}
            </Detail>
          </dl>

          {profile.organization.managerHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('hr.profile.managerHistory')}</th>
                    <th scope="col">{t('hr.profile.range')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.organization.managerHistory.map((manager) => (
                    <tr key={manager.id}>
                      <td>
                        <Localized value={manager.displayName} />
                      </td>
                      <td className="text-xs">
                        {formatDate(manager.validFrom, locale)} →{' '}
                        {manager.validTo
                          ? formatDate(manager.validTo, locale)
                          : t('hr.profile.openEnded')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </div>
      </Card>

      {has(sections, 'documents') ? (
        <Card title={t('hr.profile.documents')}>
          {profile.documents.length === 0 ? (
            <EmptyState title={t('hr.profile.documentsEmpty')} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('hr.profile.documentType')}</th>
                    <th scope="col">{t('hr.profile.classification')}</th>
                    <th scope="col">{t('hr.profile.issuedOn')}</th>
                    <th scope="col">{t('hr.profile.expiresOn')}</th>
                    <th scope="col">{t('hr.profile.archiveId')}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.documents.map((document) => (
                    <tr key={document.id}>
                      <td>{t(`documentType.${document.documentType}`, { defaultValue: document.documentType })}</td>
                      <td>{t(`classification.${document.classification}`, { defaultValue: document.classification })}</td>
                      <td>{formatDate(document.issuedOn, locale) || '—'}</td>
                      <td>{formatDate(document.expiresOn, locale) || '—'}</td>
                      <td className="font-mono text-xs">{document.archiveDocumentId}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
      ) : null}

      {has(sections, 'timeline') ? (
        <Card title={t('hr.profile.timeline')}>
          {profile.timeline.length === 0 ? (
            <EmptyState title={t('hr.profile.timelineEmpty')} />
          ) : (
            <ol className="flex flex-col gap-4">
              {profile.timeline.map((entry) => (
                <li key={entry.id} className="border-s-2 border-line ps-4">
                  <p className="text-sm font-medium text-ink-strong">
                    <Localized value={entry.summary} />
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatDate(entry.occurredOn, locale)}
                    {' · '}
                    {entry.actorName
                      ? t('hr.profile.actor', { name: entry.actorName })
                      : t('hr.profile.systemActor')}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      {has(sections, 'account') ? (
        <Card title={t('hr.profile.account')}>
          {profile.account ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label={t('hr.profile.account')}>
                <span className="font-mono text-xs">{profile.account.accountId}</span>
              </Detail>
              <Detail label={t('hr.profile.accountLinked')}>
                {formatDate(profile.account.linkedAt, locale)}
              </Detail>
            </dl>
          ) : (
            <p className="text-sm text-ink-muted">{t('hr.profile.noAccount')}</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

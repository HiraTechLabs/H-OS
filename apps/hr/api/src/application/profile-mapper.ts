import type {
  EmployeeProfile,
  EmployeeSummary,
  LocalizedText,
  ManagerView,
  OrgAssignmentView,
  ProfileSection,
  TimelineEntry,
} from '@h-os/contracts';
import { maskIdentifierTail } from '@h-os/contracts';
import type {
  EmployeeAggregate,
  OrganizationOverviewData,
  TimelineRecord,
} from './ports.js';

export interface ManagerLookup {
  readonly employeeId: string;
  readonly employeeNumber: string;
  readonly nameEn: string;
  readonly nameAr: string;
}

interface ReferenceIndex {
  readonly branch: ReadonlyMap<string, LocalizedText>;
  readonly location: ReadonlyMap<string, LocalizedText>;
  readonly unit: ReadonlyMap<string, { readonly name: LocalizedText; readonly path: string }>;
  readonly jobTitle: ReadonlyMap<string, LocalizedText>;
  readonly jobGrade: ReadonlyMap<string, LocalizedText>;
}

export function buildReferenceIndex(overview: OrganizationOverviewData): ReferenceIndex {
  return {
    branch: new Map(overview.branches.map((row) => [row.id, { en: row.nameEn, ar: row.nameAr }])),
    location: new Map(
      overview.locations.map((row) => [row.id, { en: row.nameEn, ar: row.nameAr }]),
    ),
    unit: new Map(
      overview.orgUnits.map((row) => [
        row.id,
        { name: { en: row.nameEn, ar: row.nameAr }, path: row.path },
      ]),
    ),
    jobTitle: new Map(overview.jobTitles.map((row) => [row.id, { en: row.nameEn, ar: row.nameAr }])),
    jobGrade: new Map(overview.jobGrades.map((row) => [row.id, { en: row.nameEn, ar: row.nameAr }])),
  };
}

const UNKNOWN: LocalizedText = { en: '', ar: '' };

export function summaryOf(
  aggregate: EmployeeAggregate,
  index: ReferenceIndex,
  managerNames: ReadonlyMap<string, LocalizedText>,
): EmployeeSummary {
  const currentAssignment = aggregate.assignments.find((row) => row.validTo === null) ?? null;
  const currentManager = aggregate.managers.find((row) => row.validTo === null) ?? null;
  const unit = currentAssignment ? index.unit.get(currentAssignment.orgUnitId) : undefined;
  return {
    id: aggregate.core.id,
    employeeNumber: aggregate.core.employeeNumber,
    displayName: {
      en: `${aggregate.person.givenNameEn} ${aggregate.person.familyNameEn}`.trim(),
      ar: `${aggregate.person.givenNameAr} ${aggregate.person.familyNameAr}`.trim(),
    },
    status: aggregate.core.status,
    workEmail: aggregate.core.workEmail,
    branchName: currentAssignment ? (index.branch.get(currentAssignment.branchId) ?? null) : null,
    orgUnitName: unit?.name ?? null,
    jobTitleName: currentAssignment ? (index.jobTitle.get(currentAssignment.jobTitleId) ?? null) : null,
    workLocationName: currentAssignment
      ? (index.location.get(currentAssignment.workLocationId) ?? null)
      : null,
    managerDisplayName: currentManager?.managerEmployeeId
      ? (managerNames.get(currentManager.managerEmployeeId) ?? null)
      : null,
  };
}

/** Filled by the caller before summaries are built, to avoid a hidden second data source. */
function assignmentView(
  row: EmployeeAggregate['assignments'][number],
  index: ReferenceIndex,
): OrgAssignmentView {
  const unit = index.unit.get(row.orgUnitId);
  const gradeId = row.jobGradeId;
  return {
    id: row.id,
    orgUnitId: row.orgUnitId,
    orgUnitName: unit?.name ?? UNKNOWN,
    orgUnitPath: unit?.path ?? '',
    branchId: row.branchId,
    branchName: index.branch.get(row.branchId) ?? UNKNOWN,
    workLocationId: row.workLocationId,
    workLocationName: index.location.get(row.workLocationId) ?? UNKNOWN,
    jobTitleId: row.jobTitleId,
    jobTitleName: index.jobTitle.get(row.jobTitleId) ?? UNKNOWN,
    jobGradeId: gradeId,
    jobGradeName: gradeId ? (index.jobGrade.get(gradeId) ?? null) : null,
    workArrangement: row.workArrangement as OrgAssignmentView['workArrangement'],
    workScheduleId: row.workScheduleId,
    costCenterRef: row.costCenterRef,
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
}

function managerView(
  row: EmployeeAggregate['managers'][number],
  lookup: ReadonlyMap<string, ManagerLookup>,
): ManagerView | null {
  if (!row.managerEmployeeId) return null;
  const manager = lookup.get(row.managerEmployeeId);
  if (!manager) return null;
  return {
    id: row.id,
    employeeId: manager.employeeId,
    employeeNumber: manager.employeeNumber,
    displayName: { en: manager.nameEn, ar: manager.nameAr },
    validFrom: row.validFrom,
    validTo: row.validTo,
  };
}

export interface ProfileContext {
  readonly aggregate: EmployeeAggregate;
  readonly overview: OrganizationOverviewData;
  readonly managers: ReadonlyMap<string, ManagerLookup>;
  readonly scopeLevel: string;
  readonly isSelf: boolean;
  readonly canReadSensitive: boolean;
  readonly timeline: readonly TimelineRecord[];
  readonly actorNames: ReadonlyMap<string, string>;
}

/**
 * Builds the permission-controlled profile. Sections the caller may not read are reported in
 * `visibleSections` so the UI renders an explicit forbidden state instead of a silent gap
 * (HHR-EMP-001, HHR-UX-002).
 */
export function buildProfile(context: ProfileContext): EmployeeProfile {
  const { aggregate, overview, scopeLevel, isSelf, canReadSensitive, timeline, actorNames } = context;
  const index = buildReferenceIndex(overview);
  const managerNamesMap = new Map<string, LocalizedText>();
  for (const [key, value] of context.managers) {
    managerNamesMap.set(key, { en: value.nameEn, ar: value.nameAr });
  }

  const canSeePersonal = scopeLevel === 'all' || canReadSensitive || isSelf;

  const sections: ProfileSection[] = ['employment', 'organization'];
  if (canSeePersonal) sections.push('identity', 'personal', 'contact');
  if (canSeePersonal) sections.push('documents');
  if (canSeePersonal || scopeLevel !== 'own') sections.push('timeline');
  if (scopeLevel === 'all' || canReadSensitive) sections.push('account');

  const currentEpisode = aggregate.episodes.find((row) => row.endDate === null) ?? null;

  const timelineEntries: TimelineEntry[] = timeline.map((entry) => ({
    id: entry.id,
    occurredOn: entry.occurredOn,
    recordedAt: entry.recordedAt.toISOString(),
    eventType: entry.eventType,
    actorName: entry.actorAccountId ? (actorNames.get(entry.actorAccountId) ?? null) : null,
    reason: entry.reason,
    summary: { en: entry.summaryEn, ar: entry.summaryAr },
  }));

  const currentAssignment = aggregate.assignments.find((row) => row.validTo === null) ?? null;
  const currentManagerRow = aggregate.managers.find((row) => row.validTo === null) ?? null;

  return {
    summary: summaryOf(aggregate, index, managerNamesMap),
    visibleSections: sections,
    identity: canSeePersonal
      ? {
          dateOfBirth: aggregate.person.dateOfBirth,
          gender: aggregate.person.gender,
          nationality: aggregate.person.nationality,
          nationalIdMasked: maskIdentifierTail(aggregate.person.nationalIdLast4),
          passportMasked: maskIdentifierTail(aggregate.person.passportLast4),
        }
      : null,
    contact: canSeePersonal
      ? {
          personalEmail: aggregate.contact.personalEmail,
          phone: aggregate.contact.phone,
          city: aggregate.contact.city,
        }
      : null,
    employment: {
      currentEpisode: currentEpisode
        ? {
            id: currentEpisode.id,
            episodeNo: currentEpisode.episodeNo,
            employmentType: currentEpisode.employmentType as never,
            startDate: currentEpisode.startDate,
            endDate: currentEpisode.endDate,
            probationEndDate: currentEpisode.probationEndDate,
            endReason: currentEpisode.endReason,
          }
        : null,
      episodes: aggregate.episodes.map((row) => ({
        id: row.id,
        episodeNo: row.episodeNo,
        employmentType: row.employmentType as never,
        startDate: row.startDate,
        endDate: row.endDate,
        probationEndDate: row.probationEndDate,
        endReason: row.endReason,
      })),
      contracts: aggregate.contracts.map((row) => ({
        id: row.id,
        episodeId: row.episodeId,
        contractType: row.contractType as never,
        startDate: row.startDate,
        endDate: row.endDate,
        signedOn: row.signedOn,
        archiveDocumentId: row.archiveDocumentId,
      })),
    },
    organization: {
      currentAssignment: currentAssignment ? assignmentView(currentAssignment, index) : null,
      assignments: aggregate.assignments.map((row) => assignmentView(row, index)),
      currentManager: currentManagerRow ? managerView(currentManagerRow, context.managers) : null,
      managerHistory: aggregate.managers
        .map((row) => managerView(row, context.managers))
        .filter((row): row is ManagerView => row !== null),
    },
    documents: canSeePersonal
      ? aggregate.documents.map((row) => ({
          id: row.id,
          archiveDocumentId: row.archiveDocumentId,
          documentType: row.documentType,
          classification: row.classification,
          issuedOn: row.issuedOn,
          expiresOn: row.expiresOn,
        }))
      : [],
    timeline: timelineEntries,
    account: aggregate.accountLink
      ? { accountId: aggregate.accountLink.accountId, linkedAt: aggregate.accountLink.linkedAt.toISOString() }
      : null,
  };
}

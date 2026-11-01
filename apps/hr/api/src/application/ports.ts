import type { DbExecutor } from '@h-os/kernel';
import type { ScopeLevel } from '@h-os/contracts';
import type { EmploymentStatus } from '../domain/employment-status.js';

/** Persistence-facing shapes. The domain decides rules; these carry facts. */
export interface EmployeeCoreRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly employeeNumber: string;
  readonly status: EmploymentStatus;
  readonly workEmail: string;
  readonly archivedAt: Date | null;
}

export interface PersonRecord {
  readonly givenNameEn: string;
  readonly familyNameEn: string;
  readonly givenNameAr: string;
  readonly familyNameAr: string;
  readonly dateOfBirth: string | null;
  readonly gender: 'male' | 'female' | 'undisclosed';
  readonly nationality: string | null;
  readonly nationalIdCiphertext: string | null;
  readonly nationalIdLast4: string | null;
  readonly nationalIdHash: string | null;
  readonly passportCiphertext: string | null;
  readonly passportLast4: string | null;
}

export interface ContactRecord {
  readonly personalEmail: string | null;
  readonly phone: string | null;
  readonly city: string | null;
}

export interface EmergencyContactRecord {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly priority: number;
  readonly verifiedAt: string | null;
}

export interface EpisodeRecord {
  readonly id: string;
  readonly episodeNo: number;
  readonly employmentType: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly probationEndDate: string | null;
  readonly endReason: string | null;
}

export interface ContractRecord {
  readonly id: string;
  readonly episodeId: string;
  readonly contractType: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly signedOn: string | null;
  readonly archiveDocumentId: string | null;
}

export interface AssignmentRecord {
  readonly id: string;
  readonly branchId: string;
  readonly workLocationId: string;
  readonly orgUnitId: string;
  readonly jobTitleId: string;
  readonly jobGradeId: string | null;
  readonly workArrangement: string;
  readonly workScheduleId: string | null;
  readonly costCenterRef: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly reason: string;
}

export interface ManagerRecord {
  readonly id: string;
  readonly managerEmployeeId: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly reason: string;
}

export interface StatusTransitionRecord {
  readonly id: string;
  readonly fromStatus: EmploymentStatus | null;
  readonly toStatus: EmploymentStatus;
  readonly effectiveDate: string;
  readonly recordedAt: Date;
  readonly reason: string;
}

export interface DocumentRecord {
  readonly id: string;
  readonly archiveDocumentId: string;
  readonly documentType: string;
  readonly classification: string;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
}

export interface TimelineRecord {
  readonly id: string;
  readonly eventType: string;
  readonly occurredOn: string;
  readonly recordedAt: Date;
  readonly summaryEn: string;
  readonly summaryAr: string;
  readonly reason: string | null;
  readonly actorAccountId: string | null;
}

export interface AccountLinkRecord {
  readonly accountId: string;
  readonly linkedAt: Date;
}

export interface EmployeeAggregate {
  readonly core: EmployeeCoreRecord;
  readonly person: PersonRecord;
  readonly contact: ContactRecord;
  readonly emergencyContacts: readonly EmergencyContactRecord[];
  readonly episodes: readonly EpisodeRecord[];
  readonly contracts: readonly ContractRecord[];
  readonly assignments: readonly AssignmentRecord[];
  readonly managers: readonly ManagerRecord[];
  readonly documents: readonly DocumentRecord[];
  readonly accountLink: AccountLinkRecord | null;
}

export interface NewEmployeeData {
  readonly id: string;
  readonly organizationId: string;
  readonly employeeNumber: string;
  readonly status: EmploymentStatus;
  readonly workEmail: string;
  readonly person: PersonRecord;
  readonly contact: ContactRecord;
}

export interface SearchFilter {
  readonly q?: string;
  readonly status?: readonly EmploymentStatus[];
  readonly branchId?: string;
  readonly unitId?: string;
  readonly jobTitleId?: string;
  readonly workLocationId?: string;
  readonly managerEmployeeId?: string;
}

export interface DataScope {
  readonly level: ScopeLevel;
  readonly actorEmployeeId: string | null;
  readonly actorOrgUnitPath: string | null;
}

export interface EmployeeSearchRow {
  readonly id: string;
  readonly employeeNumber: string;
  readonly displayNameEn: string;
  readonly displayNameAr: string;
  readonly status: EmploymentStatus;
  readonly workEmail: string;
  readonly branchNameEn: string | null;
  readonly branchNameAr: string | null;
  readonly unitNameEn: string | null;
  readonly unitNameAr: string | null;
  readonly jobTitleNameEn: string | null;
  readonly jobTitleNameAr: string | null;
  readonly locationNameEn: string | null;
  readonly locationNameAr: string | null;
  readonly managerNameEn: string | null;
  readonly managerNameAr: string | null;
  readonly sortKey: string;
}

export interface SearchPage {
  readonly rows: readonly EmployeeSearchRow[];
  /** Keyset for the next page: the last row's sort key plus id. */
  readonly nextCursor: { readonly key: string; readonly id: string } | null;
}

export abstract class EmployeeRepository {
  abstract nextEmployeeNumber(executor: DbExecutor, organizationId: string): Promise<string>;
  abstract insert(executor: DbExecutor, data: NewEmployeeData): Promise<void>;
  abstract findById(employeeId: string): Promise<EmployeeAggregate | null>;
  abstract findIdByAccount(organizationId: string, accountId: string): Promise<string | null>;
  abstract nationalIdHashExists(organizationId: string, hash: string): Promise<boolean>;
  abstract workEmailExists(organizationId: string, email: string): Promise<boolean>;
  abstract employeeNumberExists(organizationId: string, employeeNumber: string): Promise<boolean>;
  abstract search(
    organizationId: string,
    filter: SearchFilter,
    scope: DataScope,
    limit: number,
    cursor: { key: string; id: string } | null,
  ): Promise<SearchPage>;
  abstract updateCore(
    executor: DbExecutor,
    employeeId: string,
    values: { workEmail: string; status: EmploymentStatus; updatedAt: Date },
  ): Promise<void>;
  abstract updatePerson(executor: DbExecutor, employeeId: string, person: PersonRecord): Promise<void>;
  abstract updateContact(executor: DbExecutor, employeeId: string, contact: ContactRecord): Promise<void>;
  abstract addEmergencyContact(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    contact: { id: string; name: string; relationship: string; phone: string; priority: number },
  ): Promise<void>;
  abstract linkAccount(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    accountId: string,
    actorAccountId: string,
    at: Date,
  ): Promise<void>;
  abstract unlinkAccount(executor: DbExecutor, employeeId: string, at: Date): Promise<void>;
  abstract addDocument(
    executor: DbExecutor,
    employeeId: string,
    organizationId: string,
    document: {
      id: string;
      archiveDocumentId: string;
      documentType: string;
      classification: string;
      issuedOn: string | null;
      expiresOn: string | null;
    },
  ): Promise<void>;
}

export abstract class EmploymentRepository {
  abstract insertEpisode(
    executor: DbExecutor,
    episode: {
      id: string;
      organizationId: string;
      employeeId: string;
      episodeNo: number;
      employmentType: string;
      startDate: string;
      endDate: string | null;
      probationEndDate: string | null;
    },
  ): Promise<void>;
  abstract addContract(
    executor: DbExecutor,
    contract: {
      id: string;
      organizationId: string;
      episodeId: string;
      contractType: string;
      startDate: string;
      endDate: string | null;
      signedOn: string | null;
      archiveDocumentId: string | null;
    },
  ): Promise<void>;
  abstract closeEpisode(
    executor: DbExecutor,
    episodeId: string,
    endDate: string,
    endReason: string,
  ): Promise<void>;
  abstract addTransition(
    executor: DbExecutor,
    transition: {
      id: string;
      organizationId: string;
      employeeId: string;
      fromStatus: EmploymentStatus | null;
      toStatus: EmploymentStatus;
      effectiveDate: string;
      recordedAt: Date;
      actorAccountId: string | null;
      reason: string;
      endReason: string | null;
    },
  ): Promise<void>;
}

export abstract class AssignmentRepository {
  abstract addAssignment(
    executor: DbExecutor,
    assignment: {
      id: string;
      organizationId: string;
      employeeId: string;
      branchId: string;
      workLocationId: string;
      orgUnitId: string;
      jobTitleId: string;
      jobGradeId: string | null;
      workArrangement: string;
      workScheduleId: string | null;
      costCenterRef: string | null;
      validFrom: string;
      validTo: string | null;
      reason: string;
      recordedAt: Date;
      actorAccountId: string | null;
    },
  ): Promise<void>;
  abstract closeAssignment(
    executor: DbExecutor,
    assignmentId: string,
    validTo: string,
  ): Promise<void>;
  abstract addManager(
    executor: DbExecutor,
    manager: {
      id: string;
      organizationId: string;
      employeeId: string;
      managerEmployeeId: string | null;
      validFrom: string;
      validTo: string | null;
      reason: string;
      recordedAt: Date;
      actorAccountId: string | null;
    },
  ): Promise<void>;
  abstract closeManager(executor: DbExecutor, managerRowId: string, validTo: string): Promise<void>;
  abstract directReports(managerEmployeeId: string): Promise<readonly string[]>;
}

export abstract class TimelineRepository {
  abstract add(
    executor: DbExecutor,
    entry: {
      id: string;
      organizationId: string;
      employeeId: string;
      eventType: string;
      occurredOn: string;
      recordedAt: Date;
      summaryEn: string;
      summaryAr: string;
      actorAccountId: string | null;
      reason: string | null;
      relatedType: string | null;
      relatedId: string | null;
    },
  ): Promise<void>;
  abstract list(employeeId: string, limit: number): Promise<readonly TimelineRecord[]>;
}

export abstract class OrganizationDirectoryRepository {
  abstract branchExists(organizationId: string, branchId: string): Promise<boolean>;
  abstract workLocationBelongsTo(
    organizationId: string,
    locationId: string,
    branchId: string,
  ): Promise<boolean>;
  /** Branch that owns a work location, used to persist the assignment consistently. */
  abstract locationBranch(organizationId: string, locationId: string): Promise<string | null>;
  abstract orgUnitHeader(
    organizationId: string,
    unitId: string,
  ): Promise<{ id: string; path: string; branchId: string } | null>;
  abstract jobTitleExists(organizationId: string, jobTitleId: string): Promise<boolean>;
  abstract jobGradeExists(organizationId: string, jobGradeId: string): Promise<boolean>;
  abstract workScheduleExists(organizationId: string, scheduleId: string): Promise<boolean>;
  abstract currentOrgUnitPath(employeeId: string): Promise<string | null>;
  abstract currentManagerId(employeeId: string): Promise<string | null>;
}

export interface BranchRow {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly timeZone: string;
  readonly archivedAt: Date | null;
}

export interface WorkLocationRow {
  readonly id: string;
  readonly organizationId: string;
  readonly branchId: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly addressLine: string | null;
  readonly timeZone: string;
  readonly archivedAt: Date | null;
}

export interface OrgUnitRow {
  readonly id: string;
  readonly organizationId: string;
  readonly branchId: string;
  readonly parentId: string | null;
  readonly kind: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly path: string;
  readonly archivedAt: Date | null;
}

export interface JobTitleRow {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly archivedAt: Date | null;
}

export interface JobGradeRow {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly rank: number;
  readonly archivedAt: Date | null;
}

export interface WorkScheduleRow {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly timeZone: string;
  readonly days: readonly {
    readonly weekday: number;
    readonly isRestDay: boolean;
    readonly startLocal: string | null;
    readonly endLocal: string | null;
    readonly breakMinutes: number;
    readonly crossesMidnight: boolean;
  }[];
  readonly archivedAt: Date | null;
}

export interface OrganizationOverviewData {
  readonly branches: readonly BranchRow[];
  readonly locations: readonly WorkLocationRow[];
  readonly orgUnits: readonly OrgUnitRow[];
  readonly jobTitles: readonly JobTitleRow[];
  readonly jobGrades: readonly JobGradeRow[];
  readonly workSchedules: readonly WorkScheduleRow[];
}

export interface NewOrgUnitHistoryRow {
  readonly id: string;
  readonly organizationId: string;
  readonly orgUnitId: string;
  readonly parentId: string | null;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly effectiveFrom: string;
  readonly recordedAt: Date;
  readonly actorAccountId: string | null;
  readonly reason: string | null;
}

export abstract class OrganizationRepository {
  abstract overview(organizationId: string): Promise<OrganizationOverviewData>;
  abstract createBranch(executor: DbExecutor, row: BranchRow): Promise<void>;
  abstract createWorkLocation(executor: DbExecutor, row: WorkLocationRow): Promise<void>;
  abstract createOrgUnit(executor: DbExecutor, row: OrgUnitRow): Promise<void>;
  abstract addOrgUnitHistory(executor: DbExecutor, row: NewOrgUnitHistoryRow): Promise<void>;
  abstract createJobTitle(executor: DbExecutor, row: JobTitleRow): Promise<void>;
  abstract createJobGrade(executor: DbExecutor, row: JobGradeRow): Promise<void>;
  abstract createWorkSchedule(executor: DbExecutor, row: WorkScheduleRow): Promise<void>;
  abstract branchCodeExists(organizationId: string, code: string): Promise<boolean>;
  abstract locationCodeExists(organizationId: string, code: string): Promise<boolean>;
  abstract orgUnitCodeExists(organizationId: string, code: string): Promise<boolean>;
  abstract jobTitleCodeExists(organizationId: string, code: string): Promise<boolean>;
  abstract jobGradeCodeExists(organizationId: string, code: string): Promise<boolean>;
  abstract workScheduleCodeExists(organizationId: string, code: string): Promise<boolean>;
}

/** Injection tokens for the repository ports (`ARCH-005`: ORM types never leave infrastructure). */
export const EMPLOYEE_REPOSITORY = Symbol('EmployeeRepository');
export const EMPLOYMENT_REPOSITORY = Symbol('EmploymentRepository');
export const ASSIGNMENT_REPOSITORY = Symbol('AssignmentRepository');
export const TIMELINE_REPOSITORY = Symbol('TimelineRepository');
export const ORGANIZATION_REPOSITORY = Symbol('OrganizationRepository');
export const ORGANIZATION_DIRECTORY = Symbol('OrganizationDirectoryRepository');
export const FIELD_CIPHER = Symbol('FieldCipher');
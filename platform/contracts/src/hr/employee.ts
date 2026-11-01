import { z } from 'zod';
import { BusinessDateSchema, IdSchema, PageQuerySchema } from '../common.js';
import type { LocalizedText } from '../common.js';
import { WorkArrangementSchema } from './organization.js';
import type { WorkArrangement } from './organization.js';

/**
 * Employment lifecycle (HR-DEC-0001). Transitions are validated in the domain layer; the API
 * never trusts the client to know which transitions are legal.
 */
export const EMPLOYMENT_STATUSES = [
  'pending_start',
  'active',
  'probation',
  'suspended',
  'notice_period',
  'terminated',
  'retired',
  'cancelled',
] as const;

export const EmploymentStatusSchema = z.enum(EMPLOYMENT_STATUSES);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

export const EMPLOYMENT_TYPES = [
  'permanent',
  'fixed_term',
  'part_time',
  'temporary',
  'internship',
  'contractor',
] as const;
export const EmploymentTypeSchema = z.enum(EMPLOYMENT_TYPES);
export type EmploymentType = z.infer<typeof EmploymentTypeSchema>;

export const GENDERS = ['male', 'female', 'undisclosed'] as const;
export const GenderSchema = z.enum(GENDERS);
export type Gender = z.infer<typeof GenderSchema>;

export const CONTRACT_TYPES = ['permanent', 'fixed_term', 'part_time', 'temporary', 'internship', 'contractor'] as const;
export const ContractTypeSchema = z.enum(CONTRACT_TYPES);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const PersonNameSchema = z.strictObject({
  givenEn: z.string().min(1).max(100),
  familyEn: z.string().min(1).max(100),
  givenAr: z.string().min(1).max(100),
  familyAr: z.string().min(1).max(100),
});
export type PersonName = z.infer<typeof PersonNameSchema>;

const IdNumberSchema = z
  .string()
  .min(4)
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'Identifier may contain letters, digits and dashes only');

export const CreateEmployeeSchema = z.strictObject({
  employeeNumber: z
    .string()
    .min(1)
    .max(24)
    .regex(/^[A-Z0-9-]+$/, 'Employee number may contain capital letters, digits and dashes only')
    .optional(),
  name: PersonNameSchema,
  personal: z.strictObject({
    dateOfBirth: BusinessDateSchema.nullable(),
    gender: GenderSchema,
    nationality: z.string().min(2).max(3).nullable(),
    nationalId: IdNumberSchema.nullable(),
    passportNumber: IdNumberSchema.nullable(),
  }),
  contact: z.strictObject({
    workEmail: z.email().max(320),
    personalEmail: z.email().max(320).nullable(),
    phone: z.string().min(4).max(32).nullable(),
    city: z.string().max(100).nullable(),
  }),
  employment: z.strictObject({
    employmentType: EmploymentTypeSchema,
    startDate: BusinessDateSchema,
    probationEndDate: BusinessDateSchema.nullable(),
    contract: z
      .strictObject({
        contractType: ContractTypeSchema,
        startDate: BusinessDateSchema,
        endDate: BusinessDateSchema.nullable(),
        signedOn: BusinessDateSchema.nullable(),
        archiveDocumentId: z.string().min(1).max(128).nullable(),
      })
      .nullable(),
  }),
  assignment: z.strictObject({
    branchId: IdSchema,
    workLocationId: IdSchema,
    orgUnitId: IdSchema,
    jobTitleId: IdSchema,
    jobGradeId: IdSchema.nullable(),
    workArrangement: WorkArrangementSchema,
    workScheduleId: IdSchema.nullable(),
    costCenterRef: z.string().max(64).nullable(),
  }),
  managerEmployeeId: IdSchema.nullable(),
  accountId: IdSchema.nullable(),
});
export type CreateEmployee = z.infer<typeof CreateEmployeeSchema>;

/**
 * Protected fields (national ID, passport, personal contact) are intentionally absent: they are
 * changed through `ChangeRequest` with review (HHR-EMP-004), not by direct patch.
 */
export const UpdateEmployeeSchema = z.strictObject({
  name: PersonNameSchema.optional(),
  dateOfBirth: BusinessDateSchema.nullable().optional(),
  gender: GenderSchema.optional(),
  nationality: z.string().min(2).max(3).nullable().optional(),
  workEmail: z.email().max(320).optional(),
  city: z.string().max(100).nullable().optional(),
});
export type UpdateEmployee = z.infer<typeof UpdateEmployeeSchema>;

export const ChangeEmploymentStatusSchema = z.strictObject({
  toStatus: EmploymentStatusSchema,
  effectiveDate: BusinessDateSchema,
  reason: z.string().min(3).max(500),
  endReason: z.string().max(200).nullable().optional(),
});
export type ChangeEmploymentStatus = z.infer<typeof ChangeEmploymentStatusSchema>;

export const ChangeAssignmentSchema = z.strictObject({
  orgUnitId: IdSchema,
  workLocationId: IdSchema,
  jobTitleId: IdSchema,
  jobGradeId: IdSchema.nullable(),
  workArrangement: WorkArrangementSchema,
  workScheduleId: IdSchema.nullable(),
  costCenterRef: z.string().max(64).nullable(),
  effectiveFrom: BusinessDateSchema,
  reason: z.string().min(3).max(500),
});
export type ChangeAssignment = z.infer<typeof ChangeAssignmentSchema>;

export const ChangeManagerSchema = z.strictObject({
  managerEmployeeId: IdSchema.nullable(),
  effectiveFrom: BusinessDateSchema,
  reason: z.string().min(3).max(500),
});
export type ChangeManager = z.infer<typeof ChangeManagerSchema>;

export const LinkAccountSchema = z.strictObject({
  accountId: IdSchema,
});
export type LinkAccount = z.infer<typeof LinkAccountSchema>;

/** Reference data resolved for display. Other apps' entities appear as IDs only (ARCH-003). */
export interface OrgAssignmentView {
  readonly id: string;
  readonly orgUnitId: string;
  readonly orgUnitName: LocalizedText;
  readonly orgUnitPath: string;
  readonly branchId: string;
  readonly branchName: LocalizedText;
  readonly workLocationId: string;
  readonly workLocationName: LocalizedText;
  readonly jobTitleId: string;
  readonly jobTitleName: LocalizedText;
  readonly jobGradeId: string | null;
  readonly jobGradeName: LocalizedText | null;
  readonly workArrangement: WorkArrangement;
  readonly workScheduleId: string | null;
  readonly costCenterRef: string | null;
  /**
   * Half-open effective range `[validFrom, validTo)`: `validTo` is the first day the successor
   * assignment applies, not the last day of this one (BIZ-010).
   */
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface ManagerView {
  readonly id: string;
  readonly employeeId: string;
  readonly employeeNumber: string;
  readonly displayName: LocalizedText;
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface EmployeeSummary {
  readonly id: string;
  readonly employeeNumber: string;
  readonly displayName: LocalizedText;
  readonly status: EmploymentStatus;
  readonly workEmail: string;
  readonly branchName: LocalizedText | null;
  readonly orgUnitName: LocalizedText | null;
  readonly jobTitleName: LocalizedText | null;
  readonly workLocationName: LocalizedText | null;
  readonly managerDisplayName: LocalizedText | null;
}

export interface EmploymentEpisodeView {
  readonly id: string;
  readonly episodeNo: number;
  readonly employmentType: EmploymentType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly probationEndDate: string | null;
  readonly endReason: string | null;
}

export interface ContractView {
  readonly id: string;
  readonly episodeId: string;
  readonly contractType: ContractType;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly signedOn: string | null;
  readonly archiveDocumentId: string | null;
}

export interface TimelineEntry {
  readonly id: string;
  readonly occurredOn: string;
  readonly recordedAt: string;
  readonly eventType: string;
  readonly actorName: string | null;
  readonly reason: string | null;
  readonly summary: LocalizedText;
}

export interface DocumentReferenceView {
  readonly id: string;
  readonly archiveDocumentId: string;
  readonly documentType: string;
  readonly classification: string;
  readonly issuedOn: string | null;
  readonly expiresOn: string | null;
}

/** Sections the caller is allowed to see. The UI renders a forbidden state, not a blank gap. */
export const ProfileSectionSchema = z.enum([
  'identity',
  'personal',
  'contact',
  'employment',
  'organization',
  'documents',
  'timeline',
  'account',
]);
export type ProfileSection = z.infer<typeof ProfileSectionSchema>;

export interface EmployeeProfile {
  readonly summary: EmployeeSummary;
  readonly visibleSections: readonly ProfileSection[];
  readonly identity: {
    readonly dateOfBirth: string | null;
    readonly gender: Gender;
    readonly nationality: string | null;
    readonly nationalIdMasked: string | null;
    readonly passportMasked: string | null;
  } | null;
  readonly contact: {
    readonly personalEmail: string | null;
    readonly phone: string | null;
    readonly city: string | null;
  } | null;
  readonly employment: {
    readonly currentEpisode: EmploymentEpisodeView | null;
    readonly episodes: readonly EmploymentEpisodeView[];
    readonly contracts: readonly ContractView[];
  };
  readonly organization: {
    readonly currentAssignment: OrgAssignmentView | null;
    readonly assignments: readonly OrgAssignmentView[];
    readonly currentManager: ManagerView | null;
    readonly managerHistory: readonly ManagerView[];
  };
  readonly documents: readonly DocumentReferenceView[];
  readonly timeline: readonly TimelineEntry[];
  readonly account: { readonly accountId: string; readonly linkedAt: string } | null;
}

export const EmployeeListQuerySchema = PageQuerySchema.extend({
  q: z.string().max(120).optional(),
  /** Repeated (`?status=active&status=probation`) or comma-separated values are both accepted. */
  status: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
        : value,
    z.array(EmploymentStatusSchema).min(1).max(8).optional(),
  ),
  branchId: IdSchema.optional(),
  orgUnitId: IdSchema.optional(),
  jobTitleId: IdSchema.optional(),
  workLocationId: IdSchema.optional(),
  managerEmployeeId: IdSchema.optional(),
});
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;

export const EmployeeSearchResultSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: IdSchema,
      employeeNumber: z.string(),
      displayName: z.strictObject({ en: z.string(), ar: z.string() }),
      status: EmploymentStatusSchema,
      workEmail: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
export type EmployeeSearchResult = z.infer<typeof EmployeeSearchResultSchema>;

/**
 * Masks a full identifier, keeping only its last four characters. H-HR never stores the full
 * value, so profile views use {@link maskIdentifierTail} instead.
 */
export function maskIdentifier(value: string | null): string | null {
  if (value === null) return null;
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
}

/**
 * Renders an identifier tail that was retained on its own (H-HR stores only the last four
 * characters). The prefix is a display convention only: the full identifier never leaves the
 * encrypted column (SEC-008, HHR-SEC-006).
 */
export function maskIdentifierTail(tail: string | null): string | null {
  if (tail === null || tail.length === 0) return null;
  return `****${tail}`;
}

export const CreateEmergencyContactSchema = z.strictObject({
  name: z.string().min(1).max(120),
  relationship: z.string().min(1).max(60),
  phone: z.string().min(4).max(32),
  priority: z.number().int().min(1).max(10).default(1),
});
export type CreateEmergencyContact = z.infer<typeof CreateEmergencyContactSchema>;

/**
 * Metadata reference to a document owned by H-Archive. H-HR never stores file bytes
 * (HHR-EMP-005); the archive integration is a boundary, not a local store.
 */
export const AddDocumentReferenceSchema = z.strictObject({
  archiveDocumentId: z.string().min(1).max(128),
  documentType: z.string().min(1).max(60),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  issuedOn: BusinessDateSchema.nullable(),
  expiresOn: BusinessDateSchema.nullable(),
});
export type AddDocumentReference = z.infer<typeof AddDocumentReferenceSchema>;
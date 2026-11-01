import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';

/** PostgreSQL `ltree` path for the organization tree (STK-006). */
const ltree = customType<{ data: string }>({
  dataType: () => 'ltree',
});

/**
 * H-HR owns this schema. No other app reads it; cross-app references are IDs resolved by the
 * platform link service (ARCH-003, BIZ-011).
 */
export const hrSchema = pgSchema('hr');

export const orgUnitKind = ['department', 'team'] as const;
export const workArrangements = ['office', 'remote', 'hybrid', 'field', 'client_site'] as const;

export const branch = hrSchema.table(
  'branch',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    timeZone: text('time_zone').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('branch_code_unique').on(table.organizationId, table.code)],
);

export const workLocation = hrSchema.table(
  'work_location',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branch.id),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    addressLine: text('address_line'),
    timeZone: text('time_zone').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('work_location_code_unique').on(table.organizationId, table.code),
    index('work_location_branch_idx').on(table.branchId),
  ],
);

export const orgUnit = hrSchema.table(
  'org_unit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branch.id),
    parentId: uuid('parent_id'),
    kind: text('kind', { enum: orgUnitKind }).notNull(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    path: ltree('path').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_unit_code_unique').on(table.organizationId, table.code),
    index('org_unit_path_gist_idx').using('gist', table.path),
    index('org_unit_parent_idx').on(table.parentId),
    index('org_unit_branch_idx').on(table.branchId),
  ],
);

export const orgUnitHistory = hrSchema.table(
  'org_unit_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    orgUnitId: uuid('org_unit_id')
      .notNull()
      .references(() => orgUnit.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    actorAccountId: uuid('actor_account_id'),
    reason: text('reason'),
  },
  (table) => [index('org_unit_history_unit_idx').on(table.orgUnitId, table.effectiveFrom)],
);

export const jobTitle = hrSchema.table(
  'job_title',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('job_title_code_unique').on(table.organizationId, table.code)],
);

export const jobGrade = hrSchema.table(
  'job_grade',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    rank: integer('rank').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('job_grade_code_unique').on(table.organizationId, table.code)],
);

export interface WorkScheduleDayJson {
  readonly weekday: number;
  readonly isRestDay: boolean;
  readonly startLocal: string | null;
  readonly endLocal: string | null;
  readonly breakMinutes: number;
  readonly crossesMidnight: boolean;
}

export const workSchedule = hrSchema.table(
  'work_schedule',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    timeZone: text('time_zone').notNull(),
    days: jsonb('days').$type<readonly WorkScheduleDayJson[]>().notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('work_schedule_code_unique').on(table.organizationId, table.code)],
);

export const EMPLOYMENT_STATUS_VALUES = [
  'pending_start',
  'active',
  'probation',
  'suspended',
  'notice_period',
  'terminated',
  'retired',
  'cancelled',
] as const;

export const employmentTypeValues = [
  'permanent',
  'fixed_term',
  'part_time',
  'temporary',
  'internship',
  'contractor',
] as const;

export const employee = hrSchema.table(
  'employee',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    /** Business-facing, immutable, unique per organization. Never the primary key. */
    employeeNumber: text('employee_number').notNull(),
    status: text('status', { enum: EMPLOYMENT_STATUS_VALUES }).notNull(),
    workEmail: text('work_email').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('employee_number_unique').on(table.organizationId, table.employeeNumber),
    uniqueIndex('employee_work_email_unique').on(table.organizationId, table.workEmail),
    index('employee_status_idx').on(table.organizationId, table.status),
  ],
);

export const employeePerson = hrSchema.table('employee_person', {
  employeeId: uuid('employee_id')
    .primaryKey()
    .references(() => employee.id, { onDelete: 'cascade' }),
  givenNameEn: text('given_name_en').notNull(),
  familyNameEn: text('family_name_en').notNull(),
  givenNameAr: text('given_name_ar').notNull(),
  familyNameAr: text('family_name_ar').notNull(),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  gender: text('gender', { enum: ['male', 'female', 'undisclosed'] }).notNull(),
  nationality: text('nationality'),
  nationalIdCiphertext: text('national_id_ciphertext'),
  nationalIdLast4: text('national_id_last4'),
  nationalIdHash: text('national_id_hash'),
  passportCiphertext: text('passport_ciphertext'),
  passportLast4: text('passport_last4'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const employeeContact = hrSchema.table('employee_contact', {
  employeeId: uuid('employee_id')
    .primaryKey()
    .references(() => employee.id, { onDelete: 'cascade' }),
  personalEmail: text('personal_email'),
  phone: text('phone'),
  city: text('city'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emergencyContact = hrSchema.table(
  'emergency_contact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: text('relationship').notNull(),
    phone: text('phone').notNull(),
    priority: integer('priority').notNull().default(1),
    verifiedAt: date('verified_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('emergency_contact_employee_idx').on(table.employeeId)],
);

export const employmentEpisode = hrSchema.table(
  'employment_episode',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    episodeNo: integer('episode_no').notNull(),
    employmentType: text('employment_type', { enum: employmentTypeValues }).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    probationEndDate: date('probation_end_date', { mode: 'string' }),
    endReason: text('end_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('employment_episode_no_unique').on(table.employeeId, table.episodeNo),
    // At most one open episode per employee (HR-DEC-0001).
    uniqueIndex('employment_episode_open_unique')
      .on(table.employeeId)
      .where(sql`${table.endDate} is null`),
  ],
);

export const employmentContract = hrSchema.table(
  'employment_contract',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => employmentEpisode.id, { onDelete: 'cascade' }),
    contractType: text('contract_type', { enum: employmentTypeValues }).notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    signedOn: date('signed_on', { mode: 'string' }),
    /** Opaque H-Archive document ID; H-HR never stores the file (HHR-EMP-005). */
    archiveDocumentId: text('archive_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('employment_contract_episode_idx').on(table.episodeId)],
);

export const employeeOrgAssignment = hrSchema.table(
  'employee_org_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    branchId: uuid('branch_id').notNull(),
    workLocationId: uuid('work_location_id').notNull(),
    orgUnitId: uuid('org_unit_id').notNull(),
    jobTitleId: uuid('job_title_id').notNull(),
    jobGradeId: uuid('job_grade_id'),
    workArrangement: text('work_arrangement', { enum: workArrangements }).notNull(),
    workScheduleId: uuid('work_schedule_id'),
    costCenterRef: text('cost_center_ref'),
    /** Half-open [validFrom, validTo); a null validTo means "still in force". */
    validFrom: date('valid_from', { mode: 'string' }).notNull(),
    validTo: date('valid_to', { mode: 'string' }),
    reason: text('reason').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    actorAccountId: uuid('actor_account_id'),
  },
  (table) => [
    index('employee_org_assignment_employee_idx').on(table.employeeId, table.validFrom),
    index('employee_org_assignment_unit_idx').on(table.orgUnitId),
    index('employee_org_assignment_open_idx')
      .on(table.employeeId)
      .where(sql`${table.validTo} is null`),
  ],
);

export const employeeManagerAssignment = hrSchema.table(
  'employee_manager_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    /** Null is the explicit representation of "no direct manager" (HHR-ORG-002). */
    managerEmployeeId: uuid('manager_employee_id').references(() => employee.id),
    validFrom: date('valid_from', { mode: 'string' }).notNull(),
    validTo: date('valid_to', { mode: 'string' }),
    reason: text('reason').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    actorAccountId: uuid('actor_account_id'),
  },
  (table) => [
    index('employee_manager_assignment_employee_idx').on(table.employeeId, table.validFrom),
    index('employee_manager_assignment_manager_idx').on(table.managerEmployeeId),
    // At most one manager row in force per employee; history rows stay closed.
    uniqueIndex('employee_manager_assignment_open_unique')
      .on(table.employeeId)
      .where(sql`${table.validTo} is null`),
  ],
);

export const employeeStatusTransition = hrSchema.table(
  'employee_status_transition',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status', { enum: EMPLOYMENT_STATUS_VALUES }),
    toStatus: text('to_status', { enum: EMPLOYMENT_STATUS_VALUES }).notNull(),
    effectiveDate: date('effective_date', { mode: 'string' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    actorAccountId: uuid('actor_account_id'),
    reason: text('reason').notNull(),
    endReason: text('end_reason'),
  },
  (table) => [index('employee_status_transition_employee_idx').on(table.employeeId, table.recordedAt)],
);

export const employeeAccountLink = hrSchema.table(
  'employee_account_link',
  {
    employeeId: uuid('employee_id')
      .primaryKey()
      .references(() => employee.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    /** Platform account ID. No foreign key crosses schema boundaries (ARCH-003). */
    accountId: uuid('account_id').notNull(),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    linkedBy: uuid('linked_by'),
    unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('employee_account_link_account_unique').on(table.accountId)],
);

export const employeeDocumentRef = hrSchema.table(
  'employee_document_ref',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    archiveDocumentId: text('archive_document_id').notNull(),
    documentType: text('document_type').notNull(),
    classification: text('classification').notNull(),
    issuedOn: date('issued_on', { mode: 'string' }),
    expiresOn: date('expires_on', { mode: 'string' }),
    status: text('status', { enum: ['active', 'expired', 'revoked'] })
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('employee_document_ref_employee_idx').on(table.employeeId)],
);

export const employeeTimeline = hrSchema.table(
  'employee_timeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employee.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    summaryEn: text('summary_en').notNull(),
    summaryAr: text('summary_ar').notNull(),
    actorAccountId: uuid('actor_account_id'),
    reason: text('reason'),
    relatedType: text('related_type'),
    relatedId: text('related_id'),
  },
  (table) => [index('employee_timeline_employee_idx').on(table.employeeId, table.occurredOn)],
);

export const employeeNumberSequence = hrSchema.table('employee_number_sequence', {
  organizationId: uuid('organization_id').primaryKey(),
  lastValue: integer('last_value').notNull().default(0),
});

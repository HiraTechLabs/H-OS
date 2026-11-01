import { z } from 'zod';
import { IdSchema, LocalizedTextSchema, PageQuerySchema } from '../common.js';

export const ORG_UNIT_KINDS = ['department', 'team'] as const;
export const OrgUnitKindSchema = z.enum(ORG_UNIT_KINDS);
export type OrgUnitKind = z.infer<typeof OrgUnitKindSchema>;

export const WORK_ARRANGEMENTS = ['office', 'remote', 'hybrid', 'field', 'client_site'] as const;
export const WorkArrangementSchema = z.enum(WORK_ARRANGEMENTS);
export type WorkArrangement = z.infer<typeof WorkArrangementSchema>;

export const WeekdaySchema = z.number().int().min(0).max(6);

export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm in 24-hour form');

export const WorkScheduleDaySchema = z.strictObject({
  weekday: WeekdaySchema,
  isRestDay: z.boolean(),
  startLocal: LocalTimeSchema.nullable(),
  endLocal: LocalTimeSchema.nullable(),
  breakMinutes: z.number().int().min(0).max(720).default(0),
  crossesMidnight: z.boolean().default(false),
});
export type WorkScheduleDay = z.infer<typeof WorkScheduleDaySchema>;

export const CreateWorkScheduleSchema = z.strictObject({
  code: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
  timeZone: z.string().min(1).max(64),
  days: z.array(WorkScheduleDaySchema).length(7),
});
export type CreateWorkSchedule = z.infer<typeof CreateWorkScheduleSchema>;

export const WorkScheduleSchema = CreateWorkScheduleSchema.extend({
  id: IdSchema,
  archivedAt: z.string().nullable(),
});
export type WorkSchedule = z.infer<typeof WorkScheduleSchema>;

export const CreateBranchSchema = z.strictObject({
  code: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
  timeZone: z.string().min(1).max(64),
});
export type CreateBranch = z.infer<typeof CreateBranchSchema>;

export const BranchSchema = CreateBranchSchema.extend({
  id: IdSchema,
  archivedAt: z.string().nullable(),
});
export type Branch = z.infer<typeof BranchSchema>;

export const CreateWorkLocationSchema = z.strictObject({
  branchId: IdSchema,
  code: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
  addressLine: z.string().max(300).nullable(),
  timeZone: z.string().min(1).max(64),
});
export type CreateWorkLocation = z.infer<typeof CreateWorkLocationSchema>;

export const WorkLocationSchema = CreateWorkLocationSchema.extend({
  id: IdSchema,
  archivedAt: z.string().nullable(),
});
export type WorkLocation = z.infer<typeof WorkLocationSchema>;

export const CreateOrgUnitSchema = z.strictObject({
  branchId: IdSchema,
  parentId: IdSchema.nullable(),
  kind: OrgUnitKindSchema,
  code: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
});
export type CreateOrgUnit = z.infer<typeof CreateOrgUnitSchema>;

export const OrgUnitSchema = CreateOrgUnitSchema.extend({
  id: IdSchema,
  /** Materialized `ltree` path, e.g. `head_office.operations.payroll`. */
  path: z.string(),
  archivedAt: z.string().nullable(),
});
export type OrgUnit = z.infer<typeof OrgUnitSchema>;

export const OrgUnitNodeSchema: z.ZodType<OrgUnitNode> = z.lazy(() =>
  z.strictObject({
    unit: OrgUnitSchema,
    children: z.array(OrgUnitNodeSchema),
  }),
);

export interface OrgUnitNode {
  readonly unit: OrgUnit;
  readonly children: readonly OrgUnitNode[];
}

export const CreateJobTitleSchema = z.strictObject({
  code: z.string().min(2).max(32).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
});
export type CreateJobTitle = z.infer<typeof CreateJobTitleSchema>;

export const JobTitleSchema = CreateJobTitleSchema.extend({
  id: IdSchema,
  archivedAt: z.string().nullable(),
});
export type JobTitle = z.infer<typeof JobTitleSchema>;

export const CreateJobGradeSchema = z.strictObject({
  code: z.string().min(1).max(16).regex(/^[A-Z0-9-]+$/),
  name: LocalizedTextSchema,
  rank: z.number().int().min(0).max(999),
});
export type CreateJobGrade = z.infer<typeof CreateJobGradeSchema>;

export const JobGradeSchema = CreateJobGradeSchema.extend({
  id: IdSchema,
  archivedAt: z.string().nullable(),
});
export type JobGrade = z.infer<typeof JobGradeSchema>;

export const OrganizationOverviewSchema = z.strictObject({
  branches: z.array(BranchSchema),
  locations: z.array(WorkLocationSchema),
  orgUnits: z.array(OrgUnitSchema),
  jobTitles: z.array(JobTitleSchema),
  jobGrades: z.array(JobGradeSchema),
  workSchedules: z.array(WorkScheduleSchema),
});
export type OrganizationOverview = z.infer<typeof OrganizationOverviewSchema>;

export const OrgUnitListQuerySchema = PageQuerySchema.extend({
  branchId: IdSchema.optional(),
  kind: OrgUnitKindSchema.optional(),
});
export type OrgUnitListQuery = z.infer<typeof OrgUnitListQuerySchema>;

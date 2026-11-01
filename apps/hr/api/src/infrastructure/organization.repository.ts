import { Inject } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE } from '@h-os/kernel';
import type { Database, DbExecutor } from '@h-os/kernel';
import type {
  BranchRow,
  JobGradeRow,
  JobTitleRow,
  NewOrgUnitHistoryRow,
  OrganizationOverviewData,
  OrganizationRepository,
  OrgUnitRow,
  WorkLocationRow,
  WorkScheduleRow,
} from '../application/ports.js';
import {
  branch,
  jobGrade,
  jobTitle,
  orgUnit,
  orgUnitHistory,
  workLocation,
  workSchedule,
} from './schema.js';

export class DrizzleOrganizationRepository implements OrganizationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async overview(organizationId: string): Promise<OrganizationOverviewData> {
    const [branches, locations, orgUnits, jobTitles, jobGrades, workSchedules] = await Promise.all([
      this.db
        .select()
        .from(branch)
        .where(and(eq(branch.organizationId, organizationId), isNull(branch.archivedAt))),
      this.db
        .select()
        .from(workLocation)
        .where(
          and(eq(workLocation.organizationId, organizationId), isNull(workLocation.archivedAt)),
        ),
      this.db
        .select()
        .from(orgUnit)
        .where(and(eq(orgUnit.organizationId, organizationId), isNull(orgUnit.archivedAt))),
      this.db
        .select()
        .from(jobTitle)
        .where(and(eq(jobTitle.organizationId, organizationId), isNull(jobTitle.archivedAt))),
      this.db
        .select()
        .from(jobGrade)
        .where(and(eq(jobGrade.organizationId, organizationId), isNull(jobGrade.archivedAt))),
      this.db
        .select()
        .from(workSchedule)
        .where(
          and(eq(workSchedule.organizationId, organizationId), isNull(workSchedule.archivedAt)),
        ),
    ]);

    return {
      branches: branches.map(toBranchRow),
      locations: locations.map(toLocationRow),
      orgUnits: orgUnits.map(toOrgUnitRow),
      jobTitles: jobTitles.map(toJobTitleRow),
      jobGrades: jobGrades.map(toJobGradeRow),
      workSchedules: workSchedules.map(toWorkScheduleRow),
    };
  }

  async createBranch(executor: DbExecutor, row: BranchRow): Promise<void> {
    await executor.insert(branch).values({
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      timeZone: row.timeZone,
    });
  }

  async createWorkLocation(executor: DbExecutor, row: WorkLocationRow): Promise<void> {
    await executor.insert(workLocation).values({
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      addressLine: row.addressLine,
      timeZone: row.timeZone,
    });
  }

  async createOrgUnit(executor: DbExecutor, row: OrgUnitRow): Promise<void> {
    await executor.insert(orgUnit).values({
      id: row.id,
      organizationId: row.organizationId,
      branchId: row.branchId,
      parentId: row.parentId,
      kind: row.kind as typeof orgUnit.$inferInsert.kind,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      path: row.path,
    });
  }

  async addOrgUnitHistory(executor: DbExecutor, row: NewOrgUnitHistoryRow): Promise<void> {
    await executor.insert(orgUnitHistory).values({
      id: row.id,
      organizationId: row.organizationId,
      orgUnitId: row.orgUnitId,
      parentId: row.parentId,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      effectiveFrom: row.effectiveFrom,
      recordedAt: row.recordedAt,
      actorAccountId: row.actorAccountId,
      reason: row.reason,
    });
  }

  async createJobTitle(executor: DbExecutor, row: JobTitleRow): Promise<void> {
    await executor.insert(jobTitle).values({
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
    });
  }

  async createJobGrade(executor: DbExecutor, row: JobGradeRow): Promise<void> {
    await executor.insert(jobGrade).values({
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      rank: row.rank,
    });
  }

  async createWorkSchedule(executor: DbExecutor, row: WorkScheduleRow): Promise<void> {
    await executor.insert(workSchedule).values({
      id: row.id,
      organizationId: row.organizationId,
      code: row.code,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      timeZone: row.timeZone,
      days: row.days,
    });
  }

  async branchCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: branch.id })
      .from(branch)
      .where(and(eq(branch.organizationId, organizationId), eq(branch.code, code)))
      .limit(1);
    return row !== undefined;
  }

  async locationCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workLocation.id })
      .from(workLocation)
      .where(and(eq(workLocation.organizationId, organizationId), eq(workLocation.code, code)))
      .limit(1);
    return row !== undefined;
  }

  async orgUnitCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: orgUnit.id })
      .from(orgUnit)
      .where(and(eq(orgUnit.organizationId, organizationId), eq(orgUnit.code, code)))
      .limit(1);
    return row !== undefined;
  }

  async jobTitleCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobTitle.id })
      .from(jobTitle)
      .where(and(eq(jobTitle.organizationId, organizationId), eq(jobTitle.code, code)))
      .limit(1);
    return row !== undefined;
  }

  async jobGradeCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobGrade.id })
      .from(jobGrade)
      .where(and(eq(jobGrade.organizationId, organizationId), eq(jobGrade.code, code)))
      .limit(1);
    return row !== undefined;
  }

  async workScheduleCodeExists(organizationId: string, code: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workSchedule.id })
      .from(workSchedule)
      .where(and(eq(workSchedule.organizationId, organizationId), eq(workSchedule.code, code)))
      .limit(1);
    return row !== undefined;
  }
}

function toBranchRow(row: typeof branch.$inferSelect): BranchRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    timeZone: row.timeZone,
    archivedAt: row.archivedAt,
  };
}

function toLocationRow(row: typeof workLocation.$inferSelect): WorkLocationRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    addressLine: row.addressLine,
    timeZone: row.timeZone,
    archivedAt: row.archivedAt,
  };
}

function toOrgUnitRow(row: typeof orgUnit.$inferSelect): OrgUnitRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    branchId: row.branchId,
    parentId: row.parentId,
    kind: row.kind,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    path: row.path,
    archivedAt: row.archivedAt,
  };
}

function toJobTitleRow(row: typeof jobTitle.$inferSelect): JobTitleRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    archivedAt: row.archivedAt,
  };
}

function toJobGradeRow(row: typeof jobGrade.$inferSelect): JobGradeRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    rank: row.rank,
    archivedAt: row.archivedAt,
  };
}

function toWorkScheduleRow(row: typeof workSchedule.$inferSelect): WorkScheduleRow {
  return {
    id: row.id,
    organizationId: row.organizationId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    timeZone: row.timeZone,
    days: row.days,
    archivedAt: row.archivedAt,
  };
}

import { Inject } from '@nestjs/common';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { DATABASE } from '@h-os/kernel';
import type { Database } from '@h-os/kernel';
import type { OrganizationDirectoryRepository } from '../application/ports.js';
import {
  branch,
  employeeManagerAssignment,
  employeeOrgAssignment,
  jobGrade,
  jobTitle,
  orgUnit,
  workLocation,
  workSchedule,
} from './schema.js';

/**
 * Cheap existence and scope lookups used by use cases before loading a full aggregate, so an
 * unauthorized caller never causes sensitive rows to be read (SEC-003).
 */
export class DrizzleOrganizationDirectoryRepository implements OrganizationDirectoryRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async branchExists(organizationId: string, branchId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: branch.id })
      .from(branch)
      .where(and(eq(branch.id, branchId), eq(branch.organizationId, organizationId)))
      .limit(1);
    return row !== undefined;
  }

  async workLocationBelongsTo(
    organizationId: string,
    locationId: string,
    branchId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workLocation.id })
      .from(workLocation)
      .where(
        and(
          eq(workLocation.id, locationId),
          eq(workLocation.organizationId, organizationId),
          eq(workLocation.branchId, branchId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async locationBranch(organizationId: string, locationId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ branchId: workLocation.branchId })
      .from(workLocation)
      .where(
        and(
          eq(workLocation.id, locationId),
          eq(workLocation.organizationId, organizationId),
          isNull(workLocation.archivedAt),
        ),
      )
      .limit(1);
    return row?.branchId ?? null;
  }

  async orgUnitHeader(
    organizationId: string,
    unitId: string,
  ): Promise<{ id: string; path: string; branchId: string } | null> {
    const [row] = await this.db
      .select({ id: orgUnit.id, path: orgUnit.path, branchId: orgUnit.branchId })
      .from(orgUnit)
      .where(and(eq(orgUnit.id, unitId), eq(orgUnit.organizationId, organizationId)))
      .limit(1);
    return row ?? null;
  }

  async jobTitleExists(organizationId: string, jobTitleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobTitle.id })
      .from(jobTitle)
      .where(and(eq(jobTitle.id, jobTitleId), eq(jobTitle.organizationId, organizationId)))
      .limit(1);
    return row !== undefined;
  }

  async jobGradeExists(organizationId: string, jobGradeId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: jobGrade.id })
      .from(jobGrade)
      .where(and(eq(jobGrade.id, jobGradeId), eq(jobGrade.organizationId, organizationId)))
      .limit(1);
    return row !== undefined;
  }

  async workScheduleExists(organizationId: string, scheduleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workSchedule.id })
      .from(workSchedule)
      .where(
        and(eq(workSchedule.id, scheduleId), eq(workSchedule.organizationId, organizationId)),
      )
      .limit(1);
    return row !== undefined;
  }

  async currentOrgUnitPath(employeeId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ path: orgUnit.path })
      .from(employeeOrgAssignment)
      .innerJoin(orgUnit, eq(orgUnit.id, employeeOrgAssignment.orgUnitId))
      .where(
        and(eq(employeeOrgAssignment.employeeId, employeeId), isNull(employeeOrgAssignment.validTo)),
      )
      .orderBy(desc(employeeOrgAssignment.validFrom), asc(employeeOrgAssignment.id))
      .limit(1);
    return row?.path ?? null;
  }

  async currentManagerId(employeeId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ managerEmployeeId: employeeManagerAssignment.managerEmployeeId })
      .from(employeeManagerAssignment)
      .where(
        and(
          eq(employeeManagerAssignment.employeeId, employeeId),
          isNull(employeeManagerAssignment.validTo),
        ),
      )
      .limit(1);
    return row?.managerEmployeeId ?? null;
  }
}

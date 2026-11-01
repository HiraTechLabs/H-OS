import { Inject } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE } from '@h-os/kernel';
import type { Database, DbExecutor } from '@h-os/kernel';
import type { AssignmentRepository } from '../application/ports.js';
import { employeeManagerAssignment, employeeOrgAssignment } from './schema.js';

export class DrizzleAssignmentRepository implements AssignmentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async addAssignment(
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
  ): Promise<void> {
    await executor.insert(employeeOrgAssignment).values({
      id: assignment.id,
      organizationId: assignment.organizationId,
      employeeId: assignment.employeeId,
      branchId: assignment.branchId,
      workLocationId: assignment.workLocationId,
      orgUnitId: assignment.orgUnitId,
      jobTitleId: assignment.jobTitleId,
      jobGradeId: assignment.jobGradeId,
      workArrangement:
        assignment.workArrangement as typeof employeeOrgAssignment.$inferInsert.workArrangement,
      workScheduleId: assignment.workScheduleId,
      costCenterRef: assignment.costCenterRef,
      validFrom: assignment.validFrom,
      validTo: assignment.validTo,
      reason: assignment.reason,
      recordedAt: assignment.recordedAt,
      actorAccountId: assignment.actorAccountId,
    });
  }

  async closeAssignment(
    executor: DbExecutor,
    assignmentId: string,
    validTo: string,
  ): Promise<void> {
    await executor
      .update(employeeOrgAssignment)
      .set({ validTo })
      .where(eq(employeeOrgAssignment.id, assignmentId));
  }

  async addManager(
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
  ): Promise<void> {
    await executor.insert(employeeManagerAssignment).values({
      id: manager.id,
      organizationId: manager.organizationId,
      employeeId: manager.employeeId,
      managerEmployeeId: manager.managerEmployeeId,
      validFrom: manager.validFrom,
      validTo: manager.validTo,
      reason: manager.reason,
      recordedAt: manager.recordedAt,
      actorAccountId: manager.actorAccountId,
    });
  }

  async closeManager(executor: DbExecutor, managerRowId: string, validTo: string): Promise<void> {
    await executor
      .update(employeeManagerAssignment)
      .set({ validTo })
      .where(eq(employeeManagerAssignment.id, managerRowId));
  }

  async directReports(managerEmployeeId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ employeeId: employeeManagerAssignment.employeeId })
      .from(employeeManagerAssignment)
      .where(
        and(
          eq(employeeManagerAssignment.managerEmployeeId, managerEmployeeId),
          isNull(employeeManagerAssignment.validTo),
        ),
      );
    return rows.map((row) => row.employeeId);
  }
}

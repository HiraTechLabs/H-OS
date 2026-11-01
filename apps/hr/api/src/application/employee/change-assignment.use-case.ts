import { Inject, Injectable } from '@nestjs/common';
import type { ChangeAssignment } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import {
  CLOCK,
  DATABASE,
  ID_GENERATOR,
  NotFoundError,
  PreconditionFailedError,
  SessionService,
} from '@h-os/kernel';
import type { Actor, Clock, Database, IdGenerator } from '@h-os/kernel';
import { isBefore } from '../../domain/business-date.js';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import {
  ASSIGNMENT_REPOSITORY,
  EMPLOYEE_REPOSITORY,
  ORGANIZATION_DIRECTORY,
} from '../ports.js';
import type {
  AssignmentRepository,
  EmployeeRepository,
  OrganizationDirectoryRepository,
} from '../ports.js';

/**
 * Closes the assignment in force and opens a new one at the effective date. History is never
 * overwritten (BIZ-003, HHR-DOM-004) and the database exclusion constraint forbids overlaps.
 * A change of org unit gives different data scope, so linked sessions are revoked (SEC-014).
 */
@Injectable()
export class ChangeAssignmentUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: ChangeAssignment): Promise<void> {
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    const unit = await this.directory.orgUnitHeader(actor.organizationId, input.orgUnitId);
    if (!unit) throw new NotFoundError('The organization unit does not exist.');
    await this.scope.assertUnitWithinScope(actor, Permission.HR_EMPLOYEE_UPDATE, unit.path);

    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }
    const current = aggregate.assignments.find((row) => row.validTo === null) ?? null;
    if (current && isBefore(input.effectiveFrom, current.validFrom)) {
      throw new PreconditionFailedError(
        'The effective date cannot be before the start of the current assignment.',
      );
    }

    const branchId = await this.directory.locationBranch(actor.organizationId, input.workLocationId);
    if (!branchId) throw new NotFoundError('The work location does not exist.');
    if (!(await this.directory.jobTitleExists(actor.organizationId, input.jobTitleId))) {
      throw new NotFoundError('The job title does not exist.');
    }
    if (
      input.jobGradeId &&
      !(await this.directory.jobGradeExists(actor.organizationId, input.jobGradeId))
    ) {
      throw new NotFoundError('The job grade does not exist.');
    }
    if (
      input.workScheduleId &&
      !(await this.directory.workScheduleExists(actor.organizationId, input.workScheduleId))
    ) {
      throw new NotFoundError('The work schedule does not exist.');
    }

    const unitChanged = current ? current.orgUnitId !== input.orgUnitId : true;

    await this.db.transaction(async (tx) => {
      if (current) {
        await this.assignments.closeAssignment(tx, current.id, input.effectiveFrom);
      }
      await this.assignments.addAssignment(tx, {
        id: this.ids.uuid(),
        organizationId: actor.organizationId,
        employeeId,
        branchId,
        workLocationId: input.workLocationId,
        orgUnitId: input.orgUnitId,
        jobTitleId: input.jobTitleId,
        jobGradeId: input.jobGradeId,
        workArrangement: input.workArrangement,
        workScheduleId: input.workScheduleId,
        costCenterRef: input.costCenterRef,
        validFrom: input.effectiveFrom,
        validTo: null,
        reason: input.reason,
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
      });

      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.assignment.changed',
        employeeId,
        effectiveOn: input.effectiveFrom,
        summaries: {
          en: 'Organization assignment changed',
          ar: 'تم تغيير التعيين التنظيمي',
        },
        reason: input.reason,
        before: current
          ? {
              orgUnitId: current.orgUnitId,
              jobTitleId: current.jobTitleId,
              workLocationId: current.workLocationId,
              workArrangement: current.workArrangement,
            }
          : {},
        after: {
          orgUnitId: input.orgUnitId,
          jobTitleId: input.jobTitleId,
          workLocationId: input.workLocationId,
          workArrangement: input.workArrangement,
        },
        event: {
          type: HrEventType.ASSIGNMENT_CHANGED,
          version: 1,
          payload: {
            employeeId,
            orgUnitId: input.orgUnitId,
            jobTitleId: input.jobTitleId,
            effectiveFrom: input.effectiveFrom,
          },
        },
      });
    });

    if (unitChanged && aggregate.accountLink) {
      await this.sessions.revokeAllForAccount(
        aggregate.accountLink.accountId,
        'org_assignment_changed',
      );
    }
  }
}

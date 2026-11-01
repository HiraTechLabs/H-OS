import { Inject, Injectable } from '@nestjs/common';
import type { ChangeManager } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import {
  CLOCK,
  DATABASE,
  ID_GENERATOR,
  NotFoundError,
  PreconditionFailedError,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, Clock, Database, IdGenerator } from '@h-os/kernel';
import { isBefore } from '../../domain/business-date.js';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ASSIGNMENT_REPOSITORY, EMPLOYEE_REPOSITORY, ORGANIZATION_DIRECTORY } from '../ports.js';
import type {
  AssignmentRepository,
  EmployeeRepository,
  OrganizationDirectoryRepository,
} from '../ports.js';

const MAX_REPORTING_DEPTH = 64;

/**
 * Changes the direct manager with an effective date. `null` is a first-class "no direct manager"
 * relationship (HHR-ORG-002). A cycle in the reporting chain is refused, and the previous row is
 * closed rather than overwritten (BIZ-003).
 */
@Injectable()
export class ChangeManagerUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryRepository,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: ChangeManager): Promise<void> {
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const managerId = input.managerEmployeeId;
    if (managerId) {
      if (managerId === employeeId) {
        throw new ValidationError('An employee cannot be their own manager.');
      }
      const manager = await this.employees.findById(managerId);
      if (!manager || manager.core.organizationId !== actor.organizationId) {
        throw new NotFoundError('The selected manager does not exist.');
      }
      if (manager.core.status === 'terminated' || manager.core.status === 'retired') {
        throw new ValidationError('The selected manager is no longer employed.');
      }
      await this.assertNoCycle(employeeId, managerId);
    }

    const current = aggregate.managers.find((row) => row.validTo === null) ?? null;
    if (current && isBefore(input.effectiveFrom, current.validFrom)) {
      throw new PreconditionFailedError(
        'The effective date cannot be before the start of the current manager assignment.',
      );
    }

    await this.db.transaction(async (tx) => {
      if (current) {
        await this.assignments.closeManager(tx, current.id, input.effectiveFrom);
      }
      await this.assignments.addManager(tx, {
        id: this.ids.uuid(),
        organizationId: actor.organizationId,
        employeeId,
        managerEmployeeId: managerId,
        validFrom: input.effectiveFrom,
        validTo: null,
        reason: input.reason,
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
      });

      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.manager.changed',
        employeeId,
        effectiveOn: input.effectiveFrom,
        summaries: {
          en: managerId ? 'Direct manager changed' : 'Direct manager removed',
          ar: managerId ? 'تم تغيير المدير المباشر' : 'تم إزالة المدير المباشر',
        },
        reason: input.reason,
        before: { managerEmployeeId: current?.managerEmployeeId ?? null },
        after: { managerEmployeeId: managerId },
        event: {
          type: HrEventType.MANAGER_CHANGED,
          version: 1,
          payload: { employeeId, managerEmployeeId: managerId, effectiveFrom: input.effectiveFrom },
        },
      });
    });
  }

  private async assertNoCycle(employeeId: string, managerId: string): Promise<void> {
    let cursor: string | null = managerId;
    for (let depth = 0; depth < MAX_REPORTING_DEPTH && cursor; depth += 1) {
      if (cursor === employeeId) {
        throw new ValidationError('This manager change would create a reporting cycle.');
      }
      cursor = await this.directory.currentManagerId(cursor);
    }
  }
}

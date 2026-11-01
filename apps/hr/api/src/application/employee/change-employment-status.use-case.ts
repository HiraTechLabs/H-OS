import { Inject, Injectable } from '@nestjs/common';
import type { ChangeEmploymentStatus } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import {
  CLOCK,
  ConflictError,
  DATABASE,
  ID_GENERATOR,
  NotFoundError,
  PreconditionFailedError,
  SessionService,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, Clock, Database, IdGenerator } from '@h-os/kernel';
import {
  isEndStatus,
  allowedTransitions,
  canTransition,
  employmentStatusLabel,
} from '../../domain/employment-status.js';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ASSIGNMENT_REPOSITORY, EMPLOYEE_REPOSITORY, EMPLOYMENT_REPOSITORY } from '../ports.js';
import type {
  AssignmentRepository,
  EmployeeRepository,
  EmploymentRepository,
} from '../ports.js';

/**
 * Applies one legal lifecycle transition (HR-DEC-0001). Illegal transitions are refused by the
 * domain, not by the UI. Ending an episode also closes the open assignment and manager row so
 * organizational history stays truthful, and revokes the linked account's sessions so access
 * changes take effect immediately (SEC-014, HHR-INT-005).
 */
@Injectable()
export class ChangeEmploymentStatusUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(EMPLOYMENT_REPOSITORY) private readonly employment: EmploymentRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: ChangeEmploymentStatus): Promise<void> {
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_CHANGE_STATUS, employeeId);
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const from = aggregate.core.status;
    if (from === input.toStatus) {
      throw new ConflictError('The employee already has this status.');
    }
    if (input.toStatus === 'pending_start') {
      throw new ValidationError(
        'Re-entering employment requires a new employment episode; use the rehire operation.',
      );
    }
    if (!canTransition(from, input.toStatus)) {
      throw new PreconditionFailedError(
        `Transition from ${from} to ${input.toStatus} is not allowed. Allowed: ${allowedTransitions(from).join(', ')}.`,
      );
    }

    if (isEndStatus(input.toStatus) && !input.endReason) {
      throw new ValidationError('An end reason is required when employment ends.');
    }

    const currentEpisode = aggregate.episodes.find((row) => row.endDate === null) ?? null;
    const currentAssignment = aggregate.assignments.find((row) => row.validTo === null) ?? null;
    const currentManager = aggregate.managers.find((row) => row.validTo === null) ?? null;
    const endsNow = isEndStatus(input.toStatus);

    await this.db.transaction(async (tx) => {
      await this.employees.updateCore(tx, employeeId, {
        workEmail: aggregate.core.workEmail,
        status: input.toStatus,
        updatedAt: this.clock.now(),
      });
      await this.employment.addTransition(tx, {
        id: this.ids.uuid(),
        organizationId: actor.organizationId,
        employeeId,
        fromStatus: from,
        toStatus: input.toStatus,
        effectiveDate: input.effectiveDate,
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
        reason: input.reason,
        endReason: input.endReason ?? null,
      });

      if (endsNow && currentEpisode) {
        await this.employment.closeEpisode(
          tx,
          currentEpisode.id,
          input.effectiveDate,
          input.endReason ?? input.reason,
        );
      }
      if (endsNow && currentAssignment) {
        await this.assignments.closeAssignment(tx, currentAssignment.id, input.effectiveDate);
      }
      if (endsNow && currentManager) {
        await this.assignments.closeManager(tx, currentManager.id, input.effectiveDate);
      }

      const fromLabel = employmentStatusLabel(from);
      const toLabel = employmentStatusLabel(input.toStatus);

      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.employee.status_changed',
        employeeId,
        effectiveOn: input.effectiveDate,
        summaries: {
          en: `Employment status changed from ${fromLabel.en} to ${toLabel.en}`,
          ar: `تم تغيير حالة التوظيف من ${fromLabel.ar} إلى ${toLabel.ar}`,
        },
        reason: input.reason,
        before: { status: from },
        after: { status: input.toStatus, endReason: input.endReason ?? null },
        event: {
          type: HrEventType.EMPLOYEE_STATUS_CHANGED,
          version: 1,
          payload: {
            employeeId,
            fromStatus: from,
            toStatus: input.toStatus,
            effectiveDate: input.effectiveDate,
          },
        },
      });
    });

    if (endsNow && aggregate.accountLink) {
      await this.sessions.revokeAllForAccount(aggregate.accountLink.accountId, 'employment_ended');
    }
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type { LinkAccount } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import {
  AccountDirectoryService,
  CLOCK,
  ConflictError,
  DATABASE,
  NotFoundError,
  PermissionService,
} from '@h-os/kernel';
import type { Actor, Clock, Database } from '@h-os/kernel';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { EMPLOYEE_REPOSITORY } from '../ports.js';
import type { EmployeeRepository } from '../ports.js';

/**
 * Links an employee to an existing platform login account. The employee record and the account
 * stay separate entities (HHR-DOM-002); H-HR stores only the account ID and never reads platform
 * tables directly (ARCH-003).
 *
 * Because a link decides which person acts under which login, it is an act of account
 * administration and not an ordinary employee update: the caller needs both the H-HR permission
 * to update the record and the platform permission to administer login accounts (SEC-002).
 */
@Injectable()
export class LinkAccountUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(AccountDirectoryService) private readonly accounts: AccountDirectoryService,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: LinkAccount): Promise<void> {
    this.permissions.require(actor, Permission.PLATFORM_ACCOUNT_MANAGE);
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }
    if (aggregate.accountLink) {
      throw new ConflictError('This employee is already linked to a login account.');
    }
    const account = await this.accounts.findById(input.accountId);
    if (!account || account.organizationId !== actor.organizationId) {
      throw new NotFoundError('The login account does not exist.');
    }
    const alreadyLinked = await this.employees.findIdByAccount(
      actor.organizationId,
      input.accountId,
    );
    if (alreadyLinked) {
      throw new ConflictError('This login account is already linked to another employee.');
    }

    const now = this.clock.now();
    await this.db.transaction(async (tx) => {
      await this.employees.linkAccount(
        tx,
        employeeId,
        actor.organizationId,
        input.accountId,
        actor.accountId,
        now,
      );
      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.employee.account_linked',
        employeeId,
        effectiveOn: now.toISOString().slice(0, 10),
        summaries: { en: 'Login account linked', ar: 'تم ربط حساب الدخول' },
        reason: null,
        after: { accountId: input.accountId },
        event: {
          type: HrEventType.ACCOUNT_LINKED,
          version: 1,
          payload: { employeeId, accountId: input.accountId },
        },
      });
    });
  }
}

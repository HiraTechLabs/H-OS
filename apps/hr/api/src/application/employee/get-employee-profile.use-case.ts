import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeProfile, LocalizedText } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import {
  AccountDirectoryService,
  ForbiddenError,
  NotFoundError,
  PermissionService,
} from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { buildProfile } from '../profile-mapper.js';
import type { ManagerLookup } from '../profile-mapper.js';
import {
  EMPLOYEE_REPOSITORY,
  ORGANIZATION_REPOSITORY,
  TIMELINE_REPOSITORY,
} from '../ports.js';
import type {
  EmployeeRepository,
  OrganizationRepository,
  TimelineRepository,
} from '../ports.js';

const TIMELINE_LIMIT = 100;

/**
 * Reads one employee profile after the caller's data scope has been enforced. Sensitive sections
 * are decided per caller, and identifiers are returned masked: the API never returns a full
 * national ID or passport number in a profile read (HHR-SEC-002).
 */
@Injectable()
export class GetEmployeeProfileUseCase {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(TIMELINE_REPOSITORY) private readonly timeline: TimelineRepository,
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(AccountDirectoryService) private readonly accounts: AccountDirectoryService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string): Promise<EmployeeProfile> {
    const scopeLevel = await this.scope.assertCanAccess(
      actor,
      Permission.HR_EMPLOYEE_READ,
      employeeId,
    );
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const identity = await this.scope.identityOf(actor);
    const isSelf = identity.employeeId === employeeId;
    const canReadSensitive = this.permissions.can(actor, Permission.HR_EMPLOYEE_READ_SENSITIVE);

    const [overview, timeline] = await Promise.all([
      this.organization.overview(actor.organizationId),
      this.timeline.list(employeeId, TIMELINE_LIMIT),
    ]);

    const managers = await this.loadManagers(aggregate.managers.map((row) => row.managerEmployeeId));
    const actorNames = await this.loadActorNames(
      timeline.map((entry) => entry.actorAccountId).filter((id): id is string => id !== null),
    );

    return buildProfile({
      aggregate,
      overview,
      managers,
      scopeLevel,
      isSelf,
      canReadSensitive,
      timeline,
      actorNames,
    });
  }

  async self(actor: Actor): Promise<EmployeeProfile> {
    const identity = await this.scope.identityOf(actor);
    if (!identity.employeeId) {
      throw new ForbiddenError('Your login account is not linked to an employee record.');
    }
    return this.execute(actor, identity.employeeId);
  }

  private async loadManagers(
    managerIds: readonly (string | null)[],
  ): Promise<ReadonlyMap<string, ManagerLookup>> {
    const unique = [...new Set(managerIds.filter((id): id is string => id !== null))];
    const entries = await Promise.all(
      unique.map(async (managerId) => {
        const manager = await this.employees.findById(managerId);
        if (!manager) return null;
        const name: LocalizedText = {
          en: `${manager.person.givenNameEn} ${manager.person.familyNameEn}`.trim(),
          ar: `${manager.person.givenNameAr} ${manager.person.familyNameAr}`.trim(),
        };
        const lookup: ManagerLookup = {
          employeeId: manager.core.id,
          employeeNumber: manager.core.employeeNumber,
          nameEn: name.en,
          nameAr: name.ar,
        };
        return [managerId, lookup] as const;
      }),
    );
    return new Map(entries.filter((entry): entry is readonly [string, ManagerLookup] => entry !== null));
  }

  private async loadActorNames(accountIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const unique = [...new Set(accountIds)];
    const entries = await Promise.all(
      unique.map(async (accountId) => {
        const account = await this.accounts.findById(accountId);
        return account ? ([accountId, account.displayName] as const) : null;
      }),
    );
    return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null));
  }
}

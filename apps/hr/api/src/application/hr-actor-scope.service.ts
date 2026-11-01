import { Inject, Injectable } from '@nestjs/common';
import type { ScopeLevel } from '@h-os/contracts';
import { ForbiddenError, PermissionService } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { isDescendantPath } from '../domain/org-unit-path.js';
import { EMPLOYEE_REPOSITORY, ORGANIZATION_DIRECTORY } from './ports.js';
import type { DataScope, EmployeeRepository, OrganizationDirectoryRepository } from './ports.js';

export interface HrActorIdentity {
  readonly employeeId: string | null;
  readonly orgUnitPath: string | null;
}

/**
 * H-HR resolves the caller's employee identity and org position itself. The kernel deliberately
 * knows nothing about employees, so the platform never reads `hr` tables (BIZ-006, ARCH-003).
 *
 * Data scope is computed server-side from the org tree and applied in queries (SEC-003), and
 * every check is deny-by-default (HHR-SEC-001).
 */
@Injectable()
export class HrActorScopeService {
  constructor(
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(ORGANIZATION_DIRECTORY)
    private readonly directory: OrganizationDirectoryRepository,
  ) {}

  async identityOf(actor: Actor): Promise<HrActorIdentity> {
    const employeeId = await this.employees.findIdByAccount(actor.organizationId, actor.accountId);
    if (!employeeId) return { employeeId: null, orgUnitPath: null };
    const orgUnitPath = await this.directory.currentOrgUnitPath(employeeId);
    return { employeeId, orgUnitPath };
  }

  async dataScope(actor: Actor, permission: string): Promise<DataScope> {
    const level = this.permissions.require(actor, permission);
    return this.scopeForLevel(actor, level);
  }

  async scopeForLevel(actor: Actor, level: ScopeLevel): Promise<DataScope> {
    if (level === 'all') {
      return { level, actorEmployeeId: null, actorOrgUnitPath: null };
    }
    const identity = await this.identityOf(actor);
    return {
      level,
      actorEmployeeId: identity.employeeId,
      actorOrgUnitPath: identity.orgUnitPath,
    };
  }

  /**
   * Authorizes access to one employee before any sensitive row is loaded. A caller who fails is
   * rejected with a message that reveals nothing about the target (HHR-SEC-003).
   */
  async assertCanAccess(actor: Actor, permission: string, targetEmployeeId: string): Promise<ScopeLevel> {
    const level = this.permissions.require(actor, permission);
    if (level === 'all') return level;

    const identity = await this.identityOf(actor);
    if (level === 'own') {
      if (identity.employeeId === targetEmployeeId) return level;
      throw new ForbiddenError('You may only access your own employee record.');
    }

    const targetPath = await this.directory.currentOrgUnitPath(targetEmployeeId);
    if (!identity.orgUnitPath || !targetPath) {
      throw new ForbiddenError('You do not have access to this employee record.');
    }
    if (level === 'unit' && targetPath === identity.orgUnitPath) return level;
    if (level === 'subtree' && isDescendantPath(targetPath, identity.orgUnitPath)) return level;
    throw new ForbiddenError('You do not have access to this employee record.');
  }

  /**
   * Organization-wide configuration (branches, locations, job catalogue, schedules) has no
   * meaningful per-unit meaning, so only an organization-wide grant may change it.
   */
  async assertOrganizationWide(actor: Actor, permission: string): Promise<void> {
    const level = this.permissions.require(actor, permission);
    if (level !== 'all') {
      throw new ForbiddenError('You may only manage the organization units within your scope.');
    }
  }

  /** Creation and organization changes must target an org unit the caller actually governs. */
  async assertUnitWithinScope(actor: Actor, permission: string, unitPath: string): Promise<void> {
    const level = this.permissions.require(actor, permission);
    if (level === 'all') return;
    const identity = await this.identityOf(actor);
    if (!identity.orgUnitPath) {
      throw new ForbiddenError('You do not have access to this organization unit.');
    }
    const allowed = level === 'subtree' || level === 'unit';
    if (!allowed) {
      throw new ForbiddenError('You do not have access to this organization unit.');
    }
    if (level === 'unit' && unitPath !== identity.orgUnitPath) {
      throw new ForbiddenError('You do not have access to this organization unit.');
    }
    if (level === 'subtree' && !isDescendantPath(unitPath, identity.orgUnitPath)) {
      throw new ForbiddenError('You do not have access to this organization unit.');
    }
  }
}

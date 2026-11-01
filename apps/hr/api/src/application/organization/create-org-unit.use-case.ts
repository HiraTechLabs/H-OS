import { Inject, Injectable } from '@nestjs/common';
import type { CreateOrgUnit, OrgUnit } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import {
  AuditService,
  CLOCK,
  CONFIG,
  ConflictError,
  DATABASE,
  ID_GENERATOR,
  NotFoundError,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, AppConfig, Clock, Database, IdGenerator } from '@h-os/kernel';
import { childPath } from '../../domain/org-unit-path.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_DIRECTORY, ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationDirectoryRepository, OrganizationRepository } from '../ports.js';
import { toOrgUnitView } from './organization-mapper.js';

/**
 * Creates one org unit and its first history snapshot. The `ltree` path is derived from the
 * parent path and the code, never accepted from the client; a parent must belong to the same
 * branch, so the tree cannot silently cross branches (HHR-ORG-001).
 *
 * A caller with subtree scope may only extend the subtree they govern; creating a root unit
 * requires organization-wide scope.
 */
@Injectable()
export class CreateOrgUnitUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateOrgUnit): Promise<OrgUnit> {
    if (!(await this.directory.branchExists(actor.organizationId, input.branchId))) {
      throw new NotFoundError('The branch does not exist.');
    }

    const parent = input.parentId
      ? await this.directory.orgUnitHeader(actor.organizationId, input.parentId)
      : null;
    if (input.parentId && !parent) {
      throw new NotFoundError('The parent organization unit does not exist.');
    }
    if (parent && parent.branchId !== input.branchId) {
      throw new ValidationError('The parent organization unit belongs to a different branch.');
    }

    if (parent) {
      await this.scope.assertUnitWithinScope(
        actor,
        Permission.HR_ORGANIZATION_MANAGE,
        parent.path,
      );
    } else {
      await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    }

    if (await this.organization.orgUnitCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('An organization unit with this code already exists.');
    }

    const id = this.ids.uuid();
    const path = childPath(parent?.path ?? null, input.code);
    const today = this.clock.today(this.config.organization.timeZone);
    const row = {
      id,
      organizationId: actor.organizationId,
      branchId: input.branchId,
      parentId: input.parentId,
      kind: input.kind,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      path,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createOrgUnit(tx, row);
      await this.organization.addOrgUnitHistory(tx, {
        id: this.ids.uuid(),
        organizationId: actor.organizationId,
        orgUnitId: id,
        parentId: row.parentId,
        nameEn: row.nameEn,
        nameAr: row.nameAr,
        effectiveFrom: today,
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
        reason: 'Organization unit created',
      });
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.unit_created',
        subject: { app: 'hr', type: 'org_unit', id },
        after: {
          branchId: row.branchId,
          parentId: row.parentId,
          kind: row.kind,
          code: row.code,
          path: row.path,
        },
      });
    });

    return toOrgUnitView(row);
  }
}

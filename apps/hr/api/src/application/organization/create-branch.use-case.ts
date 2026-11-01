import { Inject, Injectable } from '@nestjs/common';
import type { Branch, CreateBranch } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { AuditService, ConflictError, DATABASE, ID_GENERATOR } from '@h-os/kernel';
import type { Actor, Database, IdGenerator } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationRepository } from '../ports.js';
import { toBranchView } from './organization-mapper.js';

/** Branches are organization-wide configuration; code uniqueness is per organization. */
@Injectable()
export class CreateBranchUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateBranch): Promise<Branch> {
    await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    if (await this.organization.branchCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('A branch with this code already exists.');
    }

    const row = {
      id: this.ids.uuid(),
      organizationId: actor.organizationId,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      timeZone: input.timeZone,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createBranch(tx, row);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.branch_created',
        subject: { app: 'hr', type: 'branch', id: row.id },
        after: { code: row.code, nameEn: row.nameEn, nameAr: row.nameAr, timeZone: row.timeZone },
      });
    });

    return toBranchView(row);
  }
}

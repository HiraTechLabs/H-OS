import { Inject, Injectable } from '@nestjs/common';
import type { CreateJobTitle, JobTitle } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { AuditService, ConflictError, DATABASE, ID_GENERATOR } from '@h-os/kernel';
import type { Actor, Database, IdGenerator } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationRepository } from '../ports.js';
import { toJobTitleView } from './organization-mapper.js';

/** The job-title catalogue is shared by every branch (HHR-ORG-003). */
@Injectable()
export class CreateJobTitleUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateJobTitle): Promise<JobTitle> {
    await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    if (await this.organization.jobTitleCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('A job title with this code already exists.');
    }

    const row = {
      id: this.ids.uuid(),
      organizationId: actor.organizationId,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createJobTitle(tx, row);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.job_title_created',
        subject: { app: 'hr', type: 'job_title', id: row.id },
        after: { code: row.code, nameEn: row.nameEn, nameAr: row.nameAr },
      });
    });

    return toJobTitleView(row);
  }
}

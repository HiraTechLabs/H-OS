import { Inject, Injectable } from '@nestjs/common';
import type { CreateJobGrade, JobGrade } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { AuditService, ConflictError, DATABASE, ID_GENERATOR } from '@h-os/kernel';
import type { Actor, Database, IdGenerator } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationRepository } from '../ports.js';
import { toJobGradeView } from './organization-mapper.js';

/** Grades are an organization-wide ordinal scale (`rank`), not a pay scale (payroll is deferred). */
@Injectable()
export class CreateJobGradeUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateJobGrade): Promise<JobGrade> {
    await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    if (await this.organization.jobGradeCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('A job grade with this code already exists.');
    }

    const row = {
      id: this.ids.uuid(),
      organizationId: actor.organizationId,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      rank: input.rank,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createJobGrade(tx, row);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.job_grade_created',
        subject: { app: 'hr', type: 'job_grade', id: row.id },
        after: { code: row.code, rank: row.rank, nameEn: row.nameEn, nameAr: row.nameAr },
      });
    });

    return toJobGradeView(row);
  }
}

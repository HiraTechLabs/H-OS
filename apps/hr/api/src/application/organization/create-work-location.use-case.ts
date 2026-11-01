import { Inject, Injectable } from '@nestjs/common';
import type { CreateWorkLocation, WorkLocation } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import {
  AuditService,
  ConflictError,
  DATABASE,
  ID_GENERATOR,
  NotFoundError,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, Database, IdGenerator } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_DIRECTORY, ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationDirectoryRepository, OrganizationRepository } from '../ports.js';
import { toWorkLocationView } from './organization-mapper.js';

/** A work location always belongs to exactly one branch (HHR-ORG-003). */
@Injectable()
export class CreateWorkLocationUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateWorkLocation): Promise<WorkLocation> {
    await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    if (!(await this.directory.branchExists(actor.organizationId, input.branchId))) {
      throw new NotFoundError('The branch does not exist.');
    }
    if (await this.organization.locationCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('A work location with this code already exists.');
    }
    if (input.addressLine !== null && input.addressLine.trim().length === 0) {
      throw new ValidationError('The address line cannot be blank.');
    }

    const row = {
      id: this.ids.uuid(),
      organizationId: actor.organizationId,
      branchId: input.branchId,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      addressLine: input.addressLine,
      timeZone: input.timeZone,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createWorkLocation(tx, row);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.location_created',
        subject: { app: 'hr', type: 'work_location', id: row.id },
        after: {
          branchId: row.branchId,
          code: row.code,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
          timeZone: row.timeZone,
        },
      });
    });

    return toWorkLocationView(row);
  }
}

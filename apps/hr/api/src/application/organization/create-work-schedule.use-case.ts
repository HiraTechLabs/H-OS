import { Inject, Injectable } from '@nestjs/common';
import type { CreateWorkSchedule, WorkSchedule } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import {
  AuditService,
  ConflictError,
  DATABASE,
  ID_GENERATOR,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, Database, IdGenerator } from '@h-os/kernel';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { ORGANIZATION_REPOSITORY } from '../ports.js';
import type { OrganizationRepository } from '../ports.js';
import { toWorkScheduleView } from './organization-mapper.js';

/**
 * Weekly work patterns. This is reference data for attendance (deferred); no hours are derived
 * from it in Phase One and no overtime rule is implied (HR-DEC-0006).
 */
@Injectable()
export class CreateWorkScheduleUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organization: OrganizationRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, input: CreateWorkSchedule): Promise<WorkSchedule> {
    await this.scope.assertOrganizationWide(actor, Permission.HR_ORGANIZATION_MANAGE);
    if (await this.organization.workScheduleCodeExists(actor.organizationId, input.code)) {
      throw new ConflictError('A work schedule with this code already exists.');
    }

    const weekdays = new Set(input.days.map((day) => day.weekday));
    if (weekdays.size !== 7) {
      throw new ValidationError('A work schedule must define each weekday exactly once.');
    }
    for (const day of input.days) {
      if (day.isRestDay) continue;
      if (!day.startLocal || !day.endLocal) {
        throw new ValidationError('A working day requires a start and an end time.');
      }
      if (!day.crossesMidnight && day.endLocal <= day.startLocal) {
        throw new ValidationError('A working day must end after it starts unless it crosses midnight.');
      }
    }

    const row = {
      id: this.ids.uuid(),
      organizationId: actor.organizationId,
      code: input.code,
      nameEn: input.name.en,
      nameAr: input.name.ar,
      timeZone: input.timeZone,
      days: input.days,
      archivedAt: null,
    };

    await this.db.transaction(async (tx) => {
      await this.organization.createWorkSchedule(tx, row);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'hr.organization.work_schedule_created',
        subject: { app: 'hr', type: 'work_schedule', id: row.id },
        after: {
          code: row.code,
          timeZone: row.timeZone,
          nameEn: row.nameEn,
          nameAr: row.nameAr,
        },
      });
    });

    return toWorkScheduleView(row);
  }
}

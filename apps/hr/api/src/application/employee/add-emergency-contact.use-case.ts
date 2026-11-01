import { Inject, Injectable } from '@nestjs/common';
import type { CreateEmergencyContact } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';
import { CLOCK, CONFIG, DATABASE, ID_GENERATOR, NotFoundError } from '@h-os/kernel';
import type { Actor, AppConfig, Clock, Database, IdGenerator } from '@h-os/kernel';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { EMPLOYEE_REPOSITORY } from '../ports.js';
import type { EmployeeRepository } from '../ports.js';

/**
 * Emergency contacts are part of the employee's own profile and are editable by the employee
 * (self-service) or by HR staff with update permission. Every change is audited (HHR-SEC-005).
 */
@Injectable()
export class AddEmergencyContactUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: CreateEmergencyContact): Promise<string> {
    const identity = await this.scope.identityOf(actor);
    if (identity.employeeId !== employeeId) {
      await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    }
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const today = this.clock.today(this.config.organization.timeZone);
    const contactId = this.ids.uuid();
    await this.db.transaction(async (tx) => {
      await this.employees.addEmergencyContact(tx, employeeId, actor.organizationId, {
        id: contactId,
        name: input.name,
        relationship: input.relationship,
        phone: input.phone,
        priority: input.priority,
      });
      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.employee.emergency_contact_added',
        employeeId,
        effectiveOn: today,
        summaries: { en: 'Emergency contact added', ar: 'تمت إضافة جهة اتصال للطوارئ' },
        reason: null,
        // The phone number is personal data and is never written to the audit snapshot.
        after: { relationship: input.relationship, priority: input.priority },
      });
    });
    return contactId;
  }
}

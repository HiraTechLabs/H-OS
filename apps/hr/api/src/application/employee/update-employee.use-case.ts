import { Inject, Injectable } from '@nestjs/common';
import type { UpdateEmployee } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import { CLOCK, CONFIG, DATABASE, ConflictError, NotFoundError } from '@h-os/kernel';
import type { Actor, AppConfig, Clock, Database } from '@h-os/kernel';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import { EMPLOYEE_REPOSITORY } from '../ports.js';
import type { EmployeeRepository } from '../ports.js';

/**
 * Updates the non-protected part of the profile. National ID, passport and personal contact
 * details are deliberately not patchable here: they change through a reviewed request
 * (HHR-EMP-004, HHR-SEC-002).
 */
@Injectable()
export class UpdateEmployeeUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
  ) {}

  async execute(actor: Actor, employeeId: string, input: UpdateEmployee): Promise<void> {
    await this.scope.assertCanAccess(actor, Permission.HR_EMPLOYEE_UPDATE, employeeId);
    const aggregate = await this.employees.findById(employeeId);
    if (!aggregate || aggregate.core.organizationId !== actor.organizationId) {
      throw new NotFoundError('The employee does not exist.');
    }

    const workEmail = input.workEmail ?? aggregate.core.workEmail;
    if (workEmail !== aggregate.core.workEmail) {
      if (await this.employees.workEmailExists(actor.organizationId, workEmail)) {
        throw new ConflictError('An employee with this work email already exists.');
      }
    }

    const person = {
      ...aggregate.person,
      givenNameEn: input.name?.givenEn ?? aggregate.person.givenNameEn,
      familyNameEn: input.name?.familyEn ?? aggregate.person.familyNameEn,
      givenNameAr: input.name?.givenAr ?? aggregate.person.givenNameAr,
      familyNameAr: input.name?.familyAr ?? aggregate.person.familyNameAr,
      dateOfBirth: input.dateOfBirth === undefined ? aggregate.person.dateOfBirth : input.dateOfBirth,
      gender: input.gender ?? aggregate.person.gender,
      nationality: input.nationality === undefined ? aggregate.person.nationality : input.nationality,
    };
    const contact = {
      ...aggregate.contact,
      city: input.city === undefined ? aggregate.contact.city : input.city,
    };

    const today = this.clock.today(this.config.organization.timeZone);

    await this.db.transaction(async (tx) => {
      await this.employees.updatePerson(tx, employeeId, person);
      await this.employees.updateContact(tx, employeeId, contact);
      await this.employees.updateCore(tx, employeeId, {
        workEmail,
        status: aggregate.core.status,
        updatedAt: this.clock.now(),
      });
      await this.recorder.record(tx, actor, actor.organizationId, {
        action: 'hr.employee.updated',
        employeeId,
        effectiveOn: today,
        summaries: { en: 'Profile details updated', ar: 'تم تحديث بيانات الملف الشخصي' },
        reason: null,
        before: {
          givenNameEn: aggregate.person.givenNameEn,
          familyNameEn: aggregate.person.familyNameEn,
          workEmail: aggregate.core.workEmail,
          city: aggregate.contact.city,
        },
        after: {
          givenNameEn: person.givenNameEn,
          familyNameEn: person.familyNameEn,
          workEmail,
          city: contact.city,
        },
        event: {
          type: HrEventType.EMPLOYEE_UPDATED,
          version: 1,
          payload: { employeeId },
        },
      });
    });
  }
}

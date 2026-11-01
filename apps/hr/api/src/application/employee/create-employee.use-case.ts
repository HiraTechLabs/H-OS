import { Inject, Injectable } from '@nestjs/common';
import type { CreateEmployee, EmploymentStatus } from '@h-os/contracts';
import { HrEventType, Permission } from '@h-os/contracts';
import {
  AccountDirectoryService,
  CLOCK,
  CONFIG,
  DATABASE,
  ConflictError,
  ID_GENERATOR,
  NotFoundError,
  PermissionService,
  ValidationError,
} from '@h-os/kernel';
import type { Actor, AppConfig, Clock, Database, IdGenerator } from '@h-os/kernel';
import { compareBusinessDates } from '../../domain/business-date.js';
import { isEmployeeNumber } from '../../domain/employee-number.js';
import { EmployeeChangeRecorder } from '../employee-change-recorder.js';
import { HrActorScopeService } from '../hr-actor-scope.service.js';
import {
  ASSIGNMENT_REPOSITORY,
  EMPLOYEE_REPOSITORY,
  EMPLOYMENT_REPOSITORY,
  FIELD_CIPHER,
  ORGANIZATION_DIRECTORY,
} from '../ports.js';
import type {
  AssignmentRepository,
  EmployeeRepository,
  EmploymentRepository,
  OrganizationDirectoryRepository,
} from '../ports.js';
import type { FieldCipher } from '../../infrastructure/field-cipher.js';

export interface CreateEmployeeResult {
  readonly employeeId: string;
  readonly employeeNumber: string;
  readonly status: EmploymentStatus;
}

/**
 * Creates the employee aggregate in one transaction: identity, person, contact, first employment
 * episode, contract, first effective-dated assignment, manager row, initial status transition,
 * timeline, audit and outbox event (HHR-DOM-001, HR-DEC-0001, ARCH-008).
 *
 * An employee is created without a login account and without a manager by default
 * (HHR-DOM-002, HHR-ORG-002); both are optional inputs.
 */
@Injectable()
export class CreateEmployeeUseCase {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EMPLOYEE_REPOSITORY) private readonly employees: EmployeeRepository,
    @Inject(EMPLOYMENT_REPOSITORY) private readonly employment: EmploymentRepository,
    @Inject(ASSIGNMENT_REPOSITORY) private readonly assignments: AssignmentRepository,
    @Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryRepository,
    @Inject(FIELD_CIPHER) private readonly cipher: FieldCipher,
    @Inject(AccountDirectoryService) private readonly accounts: AccountDirectoryService,
    @Inject(EmployeeChangeRecorder) private readonly recorder: EmployeeChangeRecorder,
    @Inject(HrActorScopeService) private readonly scope: HrActorScopeService,
    @Inject(PermissionService) private readonly permissions: PermissionService,
  ) {}

  async execute(actor: Actor, input: CreateEmployee): Promise<CreateEmployeeResult> {
    const organizationId = actor.organizationId;
    const unit = await this.directory.orgUnitHeader(organizationId, input.assignment.orgUnitId);
    if (!unit) throw new NotFoundError('The organization unit does not exist.');
    await this.scope.assertUnitWithinScope(actor, Permission.HR_EMPLOYEE_CREATE, unit.path);
    await this.validateReferences(organizationId, input);

    const contract = input.employment.contract;
    if (contract && compareBusinessDates(contract.endDate ?? '9999-12-31', contract.startDate) < 0) {
      throw new ValidationError('The contract end date cannot be before its start date.');
    }

    const nationalIdHash = input.personal.nationalId
      ? this.cipher.lookupHash(input.personal.nationalId)
      : null;
    if (
      nationalIdHash &&
      (await this.employees.nationalIdHashExists(organizationId, nationalIdHash))
    ) {
      throw new ConflictError('An employee with this national ID already exists.');
    }
    if (await this.employees.workEmailExists(organizationId, input.contact.workEmail)) {
      throw new ConflictError('An employee with this work email already exists.');
    }

    const employeeId = this.ids.uuid();
    const today = this.clock.today(this.config.organization.timeZone);
    const status: EmploymentStatus =
      compareBusinessDates(input.employment.startDate, today) > 0 ? 'pending_start' : 'active';

    if (input.employeeNumber && !isEmployeeNumber(input.employeeNumber)) {
      throw new ValidationError('The employee number format is not valid.');
    }
    if (
      input.employeeNumber &&
      (await this.employees.employeeNumberExists(organizationId, input.employeeNumber))
    ) {
      throw new ConflictError('This employee number is already in use.');
    }

    const accountId = input.accountId
      ? await this.assertAccountAvailable(organizationId, actor, input.accountId)
      : null;
    const managerEmployeeId = input.managerEmployeeId
      ? await this.assertManager(organizationId, input.managerEmployeeId)
      : null;

    const episodeId = this.ids.uuid();
    let resolvedNumber = input.employeeNumber ?? '';

    await this.db.transaction(async (tx) => {
      resolvedNumber =
        input.employeeNumber ?? (await this.employees.nextEmployeeNumber(tx, organizationId));

      await this.employees.insert(tx, {
        id: employeeId,
        organizationId,
        employeeNumber: resolvedNumber,
        status,
        workEmail: input.contact.workEmail,
        person: {
          givenNameEn: input.name.givenEn,
          familyNameEn: input.name.familyEn,
          givenNameAr: input.name.givenAr,
          familyNameAr: input.name.familyAr,
          dateOfBirth: input.personal.dateOfBirth,
          gender: input.personal.gender,
          nationality: input.personal.nationality,
          nationalIdCiphertext: input.personal.nationalId
            ? this.cipher.encrypt(input.personal.nationalId)
            : null,
          nationalIdLast4: input.personal.nationalId ? input.personal.nationalId.slice(-4) : null,
          nationalIdHash,
          passportCiphertext: input.personal.passportNumber
            ? this.cipher.encrypt(input.personal.passportNumber)
            : null,
          passportLast4: input.personal.passportNumber
            ? input.personal.passportNumber.slice(-4)
            : null,
        },
        contact: {
          personalEmail: input.contact.personalEmail,
          phone: input.contact.phone,
          city: input.contact.city,
        },
      });

      await this.employment.insertEpisode(tx, {
        id: episodeId,
        organizationId,
        employeeId,
        episodeNo: 1,
        employmentType: input.employment.employmentType,
        startDate: input.employment.startDate,
        endDate: null,
        probationEndDate: input.employment.probationEndDate,
      });

      if (contract) {
        await this.employment.addContract(tx, {
          id: this.ids.uuid(),
          organizationId,
          episodeId,
          contractType: contract.contractType,
          startDate: contract.startDate,
          endDate: contract.endDate,
          signedOn: contract.signedOn,
          archiveDocumentId: contract.archiveDocumentId,
        });
      }

      await this.assignments.addAssignment(tx, {
        id: this.ids.uuid(),
        organizationId,
        employeeId,
        branchId: input.assignment.branchId,
        workLocationId: input.assignment.workLocationId,
        orgUnitId: input.assignment.orgUnitId,
        jobTitleId: input.assignment.jobTitleId,
        jobGradeId: input.assignment.jobGradeId,
        workArrangement: input.assignment.workArrangement,
        workScheduleId: input.assignment.workScheduleId,
        costCenterRef: input.assignment.costCenterRef,
        validFrom: input.employment.startDate,
        validTo: null,
        reason: 'Initial assignment',
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
      });

      await this.assignments.addManager(tx, {
        id: this.ids.uuid(),
        organizationId,
        employeeId,
        managerEmployeeId,
        validFrom: input.employment.startDate,
        validTo: null,
        reason: managerEmployeeId ? 'Initial manager' : 'No direct manager',
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
      });

      await this.employment.addTransition(tx, {
        id: this.ids.uuid(),
        organizationId,
        employeeId,
        fromStatus: null,
        toStatus: status,
        effectiveDate: input.employment.startDate,
        recordedAt: this.clock.now(),
        actorAccountId: actor.accountId,
        reason: 'Employee created',
        endReason: null,
      });

      if (accountId) {
        await this.employees.linkAccount(
          tx,
          employeeId,
          organizationId,
          accountId,
          actor.accountId,
          this.clock.now(),
        );
      }

      await this.recorder.record(tx, actor, organizationId, {
        action: 'hr.employee.created',
        employeeId,
        effectiveOn: input.employment.startDate,
        summaries: {
          en: `Employee ${resolvedNumber} created`,
          ar: `تم إنشاء الموظف ${resolvedNumber}`,
        },
        reason: null,
        after: {
          employeeNumber: resolvedNumber,
          status,
          orgUnitId: input.assignment.orgUnitId,
          jobTitleId: input.assignment.jobTitleId,
          managerEmployeeId,
        },
        event: {
          type: HrEventType.EMPLOYEE_CREATED,
          version: 1,
          payload: {
            employeeId,
            employeeNumber: resolvedNumber,
            employmentEpisodeId: episodeId,
            effectiveFrom: input.employment.startDate,
          },
        },
      });
    });

    return { employeeId, employeeNumber: resolvedNumber, status };
  }

  private async assertAccountAvailable(
    organizationId: string,
    actor: Actor,
    accountId: string,
  ): Promise<string> {
    // Provisioning-adjacent linking during creation follows the same rule as the link endpoint:
    // the caller must also be able to administer login accounts.
    this.permissions.require(actor, Permission.PLATFORM_ACCOUNT_MANAGE);
    const account = await this.accounts.findById(accountId);
    if (!account || account.organizationId !== organizationId) {
      throw new NotFoundError('The login account does not exist.');
    }
    const linked = await this.employees.findIdByAccount(organizationId, accountId);
    if (linked) {
      throw new ConflictError('This login account is already linked to an employee.');
    }
    return accountId;
  }

  private async assertManager(organizationId: string, managerId: string): Promise<string> {
    const manager = await this.employees.findById(managerId);
    if (!manager || manager.core.organizationId !== organizationId) {
      throw new NotFoundError('The selected manager does not exist.');
    }
    if (manager.core.status === 'terminated' || manager.core.status === 'retired') {
      throw new ValidationError('The selected manager is no longer employed.');
    }
    return managerId;
  }

  private async validateReferences(organizationId: string, input: CreateEmployee): Promise<void> {
    const a = input.assignment;
    if (!(await this.directory.branchExists(organizationId, a.branchId))) {
      throw new NotFoundError('The branch does not exist.');
    }
    if (!(await this.directory.workLocationBelongsTo(organizationId, a.workLocationId, a.branchId))) {
      throw new ValidationError('The work location does not belong to the selected branch.');
    }
    if (!(await this.directory.jobTitleExists(organizationId, a.jobTitleId))) {
      throw new NotFoundError('The job title does not exist.');
    }
    if (a.jobGradeId && !(await this.directory.jobGradeExists(organizationId, a.jobGradeId))) {
      throw new NotFoundError('The job grade does not exist.');
    }
    if (
      a.workScheduleId &&
      !(await this.directory.workScheduleExists(organizationId, a.workScheduleId))
    ) {
      throw new NotFoundError('The work schedule does not exist.');
    }
  }
}

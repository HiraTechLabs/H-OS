import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AddDocumentReferenceSchema,
  ChangeAssignmentSchema,
  ChangeEmploymentStatusSchema,
  ChangeManagerSchema,
  CreateEmergencyContactSchema,
  CreateEmployeeSchema,
  EmployeeListQuerySchema,
  LinkAccountSchema,
  UpdateEmployeeSchema,
} from '@h-os/contracts';
import type {
  AddDocumentReference,
  ChangeAssignment,
  ChangeEmploymentStatus,
  ChangeManager,
  CreateEmergencyContact,
  CreateEmployee,
  EmployeeListQuery,
  EmployeeProfile,
  EmployeeSearchResult,
  LinkAccount,
  UpdateEmployee,
} from '@h-os/contracts';
import { CurrentActor, ZodValidationPipe } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { AddDocumentReferenceUseCase } from '../application/employee/add-document-reference.use-case.js';
import { AddEmergencyContactUseCase } from '../application/employee/add-emergency-contact.use-case.js';
import { ChangeAssignmentUseCase } from '../application/employee/change-assignment.use-case.js';
import { ChangeEmploymentStatusUseCase } from '../application/employee/change-employment-status.use-case.js';
import { ChangeManagerUseCase } from '../application/employee/change-manager.use-case.js';
import { CreateEmployeeUseCase } from '../application/employee/create-employee.use-case.js';
import type { CreateEmployeeResult } from '../application/employee/create-employee.use-case.js';
import { GetEmployeeProfileUseCase } from '../application/employee/get-employee-profile.use-case.js';
import { LinkAccountUseCase } from '../application/employee/link-account.use-case.js';
import { ListEmployeesUseCase } from '../application/employee/list-employees.use-case.js';
import { UpdateEmployeeUseCase } from '../application/employee/update-employee.use-case.js';

/**
 * HTTP boundary for employee records. Every handler authenticates (global guard), validates with
 * the shared contract schema, then delegates authorization and business rules to a use case
 * (ARCH-005, SEC-004). Uniqueness and lifecycle failures surface as problem+json via the kernel
 * filter.
 */
@Controller('api/v1/employees')
export class EmployeeController {
  constructor(
    @Inject(CreateEmployeeUseCase) private readonly createEmployee: CreateEmployeeUseCase,
    @Inject(ListEmployeesUseCase) private readonly listEmployees: ListEmployeesUseCase,
    @Inject(GetEmployeeProfileUseCase) private readonly getProfile: GetEmployeeProfileUseCase,
    @Inject(UpdateEmployeeUseCase) private readonly updateEmployee: UpdateEmployeeUseCase,
    @Inject(ChangeEmploymentStatusUseCase)
    private readonly changeStatus: ChangeEmploymentStatusUseCase,
    @Inject(ChangeAssignmentUseCase) private readonly changeAssignment: ChangeAssignmentUseCase,
    @Inject(ChangeManagerUseCase) private readonly changeManager: ChangeManagerUseCase,
    @Inject(LinkAccountUseCase) private readonly linkAccount: LinkAccountUseCase,
    @Inject(AddEmergencyContactUseCase)
    private readonly addEmergencyContact: AddEmergencyContactUseCase,
    @Inject(AddDocumentReferenceUseCase)
    private readonly addDocumentReference: AddDocumentReferenceUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateEmployeeSchema)) input: CreateEmployee,
  ): Promise<CreateEmployeeResult> {
    return this.createEmployee.execute(actor, input);
  }

  @Get()
  async list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(EmployeeListQuerySchema)) query: EmployeeListQuery,
  ): Promise<EmployeeSearchResult> {
    return this.listEmployees.execute(actor, query);
  }

  /** Self-service profile. Declared before `:id` so `me` is never parsed as an identifier. */
  @Get('me')
  async me(@CurrentActor() actor: Actor): Promise<EmployeeProfile> {
    return this.getProfile.self(actor);
  }

  @Get(':id')
  async findOne(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeProfile> {
    return this.getProfile.execute(actor, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeSchema)) input: UpdateEmployee,
  ): Promise<void> {
    await this.updateEmployee.execute(actor, id, input);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeEmploymentStatus(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ChangeEmploymentStatusSchema)) input: ChangeEmploymentStatus,
  ): Promise<void> {
    await this.changeStatus.execute(actor, id, input);
  }

  @Post(':id/assignment')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeOrgAssignment(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ChangeAssignmentSchema)) input: ChangeAssignment,
  ): Promise<void> {
    await this.changeAssignment.execute(actor, id, input);
  }

  @Post(':id/manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changeReportingManager(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ChangeManagerSchema)) input: ChangeManager,
  ): Promise<void> {
    await this.changeManager.execute(actor, id, input);
  }

  @Post(':id/account-link')
  @HttpCode(HttpStatus.NO_CONTENT)
  async linkLoginAccount(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LinkAccountSchema)) input: LinkAccount,
  ): Promise<void> {
    await this.linkAccount.execute(actor, id, input);
  }

  @Post(':id/emergency-contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateEmergencyContactSchema)) input: CreateEmergencyContact,
  ): Promise<{ id: string }> {
    return { id: await this.addEmergencyContact.execute(actor, id, input) };
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddDocumentReferenceSchema)) input: AddDocumentReference,
  ): Promise<{ id: string }> {
    return { id: await this.addDocumentReference.execute(actor, id, input) };
  }
}

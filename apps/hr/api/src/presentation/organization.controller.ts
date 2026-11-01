import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import {
  CreateBranchSchema,
  CreateJobGradeSchema,
  CreateJobTitleSchema,
  CreateOrgUnitSchema,
  CreateWorkLocationSchema,
  CreateWorkScheduleSchema,
} from '@h-os/contracts';
import type {
  Branch,
  CreateBranch,
  CreateJobGrade,
  CreateJobTitle,
  CreateOrgUnit,
  CreateWorkLocation,
  CreateWorkSchedule,
  JobGrade,
  JobTitle,
  OrganizationOverview,
  OrgUnit,
  WorkLocation,
  WorkSchedule,
} from '@h-os/contracts';
import { CurrentActor, ZodValidationPipe } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { CreateBranchUseCase } from '../application/organization/create-branch.use-case.js';
import { CreateJobGradeUseCase } from '../application/organization/create-job-grade.use-case.js';
import { CreateJobTitleUseCase } from '../application/organization/create-job-title.use-case.js';
import { CreateOrgUnitUseCase } from '../application/organization/create-org-unit.use-case.js';
import { CreateWorkLocationUseCase } from '../application/organization/create-work-location.use-case.js';
import { CreateWorkScheduleUseCase } from '../application/organization/create-work-schedule.use-case.js';
import { GetOrganizationUseCase } from '../application/organization/get-organization.use-case.js';

/**
 * Organization structure reference data. Codes are unique per organization and every change is
 * audited with the acting account; the `ltree` path is always derived server-side (HHR-ORG-001).
 */
@Controller('api/v1/organization')
export class OrganizationController {
  constructor(
    @Inject(GetOrganizationUseCase) private readonly getOrganization: GetOrganizationUseCase,
    @Inject(CreateBranchUseCase) private readonly createBranch: CreateBranchUseCase,
    @Inject(CreateWorkLocationUseCase)
    private readonly createWorkLocation: CreateWorkLocationUseCase,
    @Inject(CreateOrgUnitUseCase) private readonly createOrgUnit: CreateOrgUnitUseCase,
    @Inject(CreateJobTitleUseCase) private readonly createJobTitle: CreateJobTitleUseCase,
    @Inject(CreateJobGradeUseCase) private readonly createJobGrade: CreateJobGradeUseCase,
    @Inject(CreateWorkScheduleUseCase)
    private readonly createWorkSchedule: CreateWorkScheduleUseCase,
  ) {}

  @Get()
  async overview(@CurrentActor() actor: Actor): Promise<OrganizationOverview> {
    return this.getOrganization.execute(actor);
  }

  @Post('branches')
  @HttpCode(HttpStatus.CREATED)
  async addBranch(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateBranchSchema)) input: CreateBranch,
  ): Promise<Branch> {
    return this.createBranch.execute(actor, input);
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  async addLocation(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateWorkLocationSchema)) input: CreateWorkLocation,
  ): Promise<WorkLocation> {
    return this.createWorkLocation.execute(actor, input);
  }

  @Post('org-units')
  @HttpCode(HttpStatus.CREATED)
  async addOrgUnit(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateOrgUnitSchema)) input: CreateOrgUnit,
  ): Promise<OrgUnit> {
    return this.createOrgUnit.execute(actor, input);
  }

  @Post('job-titles')
  @HttpCode(HttpStatus.CREATED)
  async addJobTitle(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateJobTitleSchema)) input: CreateJobTitle,
  ): Promise<JobTitle> {
    return this.createJobTitle.execute(actor, input);
  }

  @Post('job-grades')
  @HttpCode(HttpStatus.CREATED)
  async addJobGrade(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateJobGradeSchema)) input: CreateJobGrade,
  ): Promise<JobGrade> {
    return this.createJobGrade.execute(actor, input);
  }

  @Post('work-schedules')
  @HttpCode(HttpStatus.CREATED)
  async addWorkSchedule(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateWorkScheduleSchema)) input: CreateWorkSchedule,
  ): Promise<WorkSchedule> {
    return this.createWorkSchedule.execute(actor, input);
  }
}

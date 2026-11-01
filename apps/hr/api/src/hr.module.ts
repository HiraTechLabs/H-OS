import { Module } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { EmployeeChangeRecorder } from './application/employee-change-recorder.js';
import { AddDocumentReferenceUseCase } from './application/employee/add-document-reference.use-case.js';
import { AddEmergencyContactUseCase } from './application/employee/add-emergency-contact.use-case.js';
import { ChangeAssignmentUseCase } from './application/employee/change-assignment.use-case.js';
import { ChangeEmploymentStatusUseCase } from './application/employee/change-employment-status.use-case.js';
import { ChangeManagerUseCase } from './application/employee/change-manager.use-case.js';
import { CreateEmployeeUseCase } from './application/employee/create-employee.use-case.js';
import { GetEmployeeProfileUseCase } from './application/employee/get-employee-profile.use-case.js';
import { LinkAccountUseCase } from './application/employee/link-account.use-case.js';
import { ListEmployeesUseCase } from './application/employee/list-employees.use-case.js';
import { UpdateEmployeeUseCase } from './application/employee/update-employee.use-case.js';
import { HrActorScopeService } from './application/hr-actor-scope.service.js';
import { CreateBranchUseCase } from './application/organization/create-branch.use-case.js';
import { CreateJobGradeUseCase } from './application/organization/create-job-grade.use-case.js';
import { CreateJobTitleUseCase } from './application/organization/create-job-title.use-case.js';
import { CreateOrgUnitUseCase } from './application/organization/create-org-unit.use-case.js';
import { CreateWorkLocationUseCase } from './application/organization/create-work-location.use-case.js';
import { CreateWorkScheduleUseCase } from './application/organization/create-work-schedule.use-case.js';
import { GetOrganizationUseCase } from './application/organization/get-organization.use-case.js';
import {
  ASSIGNMENT_REPOSITORY,
  EMPLOYEE_REPOSITORY,
  EMPLOYMENT_REPOSITORY,
  FIELD_CIPHER,
  ORGANIZATION_DIRECTORY,
  ORGANIZATION_REPOSITORY,
  TIMELINE_REPOSITORY,
} from './application/ports.js';
import { DrizzleAssignmentRepository } from './infrastructure/assignment.repository.js';
import { DrizzleEmployeeRepository } from './infrastructure/employee.repository.js';
import { DrizzleEmploymentRepository } from './infrastructure/employment.repository.js';
import { createFieldCipherFromEnv } from './infrastructure/field-cipher.js';
import { DrizzleOrganizationDirectoryRepository } from './infrastructure/organization-directory.repository.js';
import { DrizzleOrganizationRepository } from './infrastructure/organization.repository.js';
import { DrizzleTimelineRepository } from './infrastructure/timeline.repository.js';
import { EmployeeController } from './presentation/employee.controller.js';
import { OrganizationController } from './presentation/organization.controller.js';

const repositories: readonly Provider[] = [
  { provide: EMPLOYEE_REPOSITORY, useClass: DrizzleEmployeeRepository },
  { provide: EMPLOYMENT_REPOSITORY, useClass: DrizzleEmploymentRepository },
  { provide: ASSIGNMENT_REPOSITORY, useClass: DrizzleAssignmentRepository },
  { provide: TIMELINE_REPOSITORY, useClass: DrizzleTimelineRepository },
  { provide: ORGANIZATION_REPOSITORY, useClass: DrizzleOrganizationRepository },
  { provide: ORGANIZATION_DIRECTORY, useClass: DrizzleOrganizationDirectoryRepository },
  // Key material comes from the environment; production refuses to boot without it.
  { provide: FIELD_CIPHER, useFactory: () => createFieldCipherFromEnv() },
];

const useCases: readonly Provider[] = [
  HrActorScopeService,
  EmployeeChangeRecorder,
  CreateEmployeeUseCase,
  UpdateEmployeeUseCase,
  ChangeEmploymentStatusUseCase,
  ChangeAssignmentUseCase,
  ChangeManagerUseCase,
  LinkAccountUseCase,
  GetEmployeeProfileUseCase,
  ListEmployeesUseCase,
  AddEmergencyContactUseCase,
  AddDocumentReferenceUseCase,
  GetOrganizationUseCase,
  CreateBranchUseCase,
  CreateWorkLocationUseCase,
  CreateOrgUnitUseCase,
  CreateJobTitleUseCase,
  CreateJobGradeUseCase,
  CreateWorkScheduleUseCase,
];

/**
 * H-HR application module. It depends only on the platform kernel's public API and owns its own
 * schema; the kernel never imports H-HR, so there is no cycle (ARCH-003, ARCH-004).
 */
@Module({
  controllers: [EmployeeController, OrganizationController],
  providers: [...repositories, ...useCases],
  exports: [HrActorScopeService],
})
export class HrModule {}

import type {
  CreateBranch,
  CreateJobGrade,
  CreateJobTitle,
  CreateOrgUnit,
  CreateWorkLocation,
  CreateWorkSchedule,
  OrganizationOverview,
} from '@h-os/contracts';
import { apiRequest } from '@h-os/web-client';

export function fetchOrganization(): Promise<OrganizationOverview> {
  return apiRequest<OrganizationOverview>('/organization');
}

export function createBranch(input: CreateBranch): Promise<unknown> {
  return apiRequest('/organization/branches', { method: 'POST', body: input });
}

export function createWorkLocation(input: CreateWorkLocation): Promise<unknown> {
  return apiRequest('/organization/locations', { method: 'POST', body: input });
}

export function createOrgUnit(input: CreateOrgUnit): Promise<unknown> {
  return apiRequest('/organization/org-units', { method: 'POST', body: input });
}

export function createJobTitle(input: CreateJobTitle): Promise<unknown> {
  return apiRequest('/organization/job-titles', { method: 'POST', body: input });
}

export function createJobGrade(input: CreateJobGrade): Promise<unknown> {
  return apiRequest('/organization/job-grades', { method: 'POST', body: input });
}

export function createWorkSchedule(input: CreateWorkSchedule): Promise<unknown> {
  return apiRequest('/organization/work-schedules', { method: 'POST', body: input });
}

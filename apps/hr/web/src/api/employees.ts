import type {
  AddDocumentReference,
  ChangeAssignment,
  ChangeEmploymentStatus,
  ChangeManager,
  CreateEmergencyContact,
  CreateEmployee,
  EmployeeProfile,
  EmployeeSearchResult,
  UpdateEmployee,
} from '@h-os/contracts';
import { apiRequest } from '@h-os/web-client';

export interface EmployeeFilters {
  readonly q?: string;
  readonly status?: string;
  readonly branchId?: string;
  readonly orgUnitId?: string;
  readonly jobTitleId?: string;
  readonly workLocationId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

function toQuery(filters: EmployeeFilters): string {
  const search = new URLSearchParams();
  if (filters.q) search.set('q', filters.q);
  if (filters.status) search.set('status', filters.status);
  if (filters.branchId) search.set('branchId', filters.branchId);
  if (filters.orgUnitId) search.set('orgUnitId', filters.orgUnitId);
  if (filters.jobTitleId) search.set('jobTitleId', filters.jobTitleId);
  if (filters.workLocationId) search.set('workLocationId', filters.workLocationId);
  if (filters.limit) search.set('limit', String(filters.limit));
  if (filters.cursor) search.set('cursor', filters.cursor);
  const value = search.toString();
  return value.length > 0 ? `?${value}` : '';
}

export function fetchEmployees(filters: EmployeeFilters): Promise<EmployeeSearchResult> {
  return apiRequest<EmployeeSearchResult>(`/employees${toQuery(filters)}`);
}

export function fetchEmployee(employeeId: string): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfile>(`/employees/${employeeId}`);
}

export function fetchMyProfile(): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfile>('/employees/me');
}

export function createEmployee(input: CreateEmployee): Promise<{
  employeeId: string;
  employeeNumber: string;
  status: string;
}> {
  return apiRequest('/employees', { method: 'POST', body: input });
}

export function updateEmployee(employeeId: string, input: UpdateEmployee): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}`, {
    method: 'PATCH',
    body: input,
    expectEmpty: true,
  });
}

export function changeEmploymentStatus(
  employeeId: string,
  input: ChangeEmploymentStatus,
): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}/status`, {
    method: 'POST',
    body: input,
    expectEmpty: true,
  });
}

export function changeAssignment(employeeId: string, input: ChangeAssignment): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}/assignment`, {
    method: 'POST',
    body: input,
    expectEmpty: true,
  });
}

export function changeManager(employeeId: string, input: ChangeManager): Promise<void> {
  return apiRequest<void>(`/employees/${employeeId}/manager`, {
    method: 'POST',
    body: input,
    expectEmpty: true,
  });
}

export function addEmergencyContact(
  employeeId: string,
  input: CreateEmergencyContact,
): Promise<{ id: string }> {
  return apiRequest(`/employees/${employeeId}/emergency-contacts`, {
    method: 'POST',
    body: input,
  });
}

export function addDocumentReference(
  employeeId: string,
  input: AddDocumentReference,
): Promise<{ id: string }> {
  return apiRequest(`/employees/${employeeId}/documents`, { method: 'POST', body: input });
}

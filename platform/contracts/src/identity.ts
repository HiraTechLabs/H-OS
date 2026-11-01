import { z } from 'zod';

/**
 * Permission catalogue. Authorization is deny-by-default (SEC-001, HHR-SEC-001) and every
 * permission is checked in the backend per data scope (SEC-002, SEC-003).
 */
export const Permission = {
  HR_EMPLOYEE_READ: 'hr.employee.read',
  HR_EMPLOYEE_READ_SENSITIVE: 'hr.employee.read.sensitive',
  HR_EMPLOYEE_CREATE: 'hr.employee.create',
  HR_EMPLOYEE_UPDATE: 'hr.employee.update',
  HR_EMPLOYEE_CHANGE_STATUS: 'hr.employee.change_status',
  HR_EMPLOYEE_EXPORT: 'hr.employee.export',
  HR_ORGANIZATION_READ: 'hr.organization.read',
  HR_ORGANIZATION_MANAGE: 'hr.organization.manage',
  HR_AUDIT_READ: 'hr.audit.read',
  PLATFORM_ACCOUNT_MANAGE: 'platform.account.manage',
  PLATFORM_INTEGRATION_RETRY: 'platform.integration.retry',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

/** Data scope levels, derived from the org tree (SEC-003, BIZ-006). */
export const ScopeLevelSchema = z.enum(['own', 'unit', 'subtree', 'all']);
export type ScopeLevel = z.infer<typeof ScopeLevelSchema>;

export const RoleCode = {
  HR_ADMIN: 'hr_admin',
  HR_OFFICER: 'hr_officer',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
  PAYROLL_REVIEWER: 'payroll_reviewer',
  AUDITOR: 'auditor',
} as const;

export type RoleCode = (typeof RoleCode)[keyof typeof RoleCode];

/** A granted permission together with the widest data scope it applies to. */
export interface PermissionGrant {
  readonly permission: string;
  readonly scope: ScopeLevel;
}

export const SessionUserSchema = z.strictObject({
  accountId: z.uuid(),
  displayName: z.string(),
  email: z.email(),
  locale: z.enum(['en', 'ar']),
  roles: z.array(z.string()),
  grants: z.array(
    z.strictObject({
      permission: z.string(),
      scope: ScopeLevelSchema,
    }),
  ),
});
export type SessionUser = z.infer<typeof SessionUserSchema>;

export const LoginRequestSchema = z.strictObject({
  email: z.email().max(320),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionResponseSchema = z.strictObject({
  user: SessionUserSchema,
  expiresAt: z.string(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * Account administration (platform.account.manage). Roles are resolved against the receiving
 * organization's role table; the schema bounds the input only.
 */
export const CreateAccountRequestSchema = z.strictObject({
  email: z.email().max(320),
  displayName: z.string().trim().min(1).max(100),
  // Matches the credential policy used for the bootstrap account.
  password: z.string().min(12).max(256),
  locale: z.enum(['en', 'ar']).default('en'),
  roles: z.array(z.string().min(2).max(64)).max(8).default([]),
});
export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

export const RoleAssignmentRequestSchema = z.strictObject({
  roleCode: z.string().min(2).max(64),
});
export type RoleAssignmentRequest = z.infer<typeof RoleAssignmentRequestSchema>;

export const AccountStatusSchema = z.enum(['active', 'suspended', 'disabled']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AccountSummarySchema = z.strictObject({
  accountId: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  status: AccountStatusSchema,
  roles: z.array(z.string()),
});
export type AccountSummary = z.infer<typeof AccountSummarySchema>;

export const AccountListResponseSchema = z.strictObject({
  items: z.array(AccountSummarySchema),
});
export type AccountListResponse = z.infer<typeof AccountListResponseSchema>;

/** Static permission→scope resolution used by the backend guards. */
export function widestScope(grants: readonly PermissionGrant[], permission: Permission): ScopeLevel | null {
  const order: readonly ScopeLevel[] = ['own', 'unit', 'subtree', 'all'];
  let best: ScopeLevel | null = null;
  for (const grant of grants) {
    if (grant.permission !== permission) continue;
    if (best === null || order.indexOf(grant.scope) > order.indexOf(best)) {
      best = grant.scope;
    }
  }
  return best;
}

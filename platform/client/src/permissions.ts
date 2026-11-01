import type { SessionUser } from '@h-os/contracts';
import { Permission } from '@h-os/contracts';

export function hasPermission(
  user: SessionUser | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  return user.grants.some((grant) => grant.permission === permission);
}

export function hasAnyPermission(
  user: SessionUser | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Widest scope the caller holds for a permission, or `null` when the permission is absent.
 * Navigation uses this only to decide what to show; the server re-checks every request
 * (UX-002, SEC-002).
 */
export function scopeOf(
  user: SessionUser | null,
  permission: Permission,
): 'own' | 'unit' | 'subtree' | 'all' | null {
  if (!user) return null;
  const order = ['own', 'unit', 'subtree', 'all'] as const;
  let best: (typeof order)[number] | null = null;
  for (const grant of user.grants) {
    if (grant.permission !== permission) continue;
    if (best === null || order.indexOf(grant.scope) > order.indexOf(best)) best = grant.scope;
  }
  return best;
}

export const READ_PERMISSIONS: readonly Permission[] = [
  Permission.HR_EMPLOYEE_READ,
  Permission.HR_EMPLOYEE_READ_SENSITIVE,
];

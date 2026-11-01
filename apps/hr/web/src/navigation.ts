import type { Permission } from '@h-os/contracts';

export interface HrNavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly permission: Permission;
}

/**
 * Navigation entries H-HR contributes to the shell. The shell filters them by the session's
 * grants; the server still authorizes every request (UX-002, HHR-UX-003).
 */
export const hrNavItems: readonly HrNavItem[] = [
  {
    path: '/employees',
    labelKey: 'nav.employees',
    permission: 'hr.employee.read' as Permission,
  },
  {
    path: '/organization',
    labelKey: 'nav.organization',
    permission: 'hr.organization.read' as Permission,
  },
  {
    path: '/me',
    labelKey: 'nav.myProfile',
    permission: 'hr.employee.read' as Permission,
  },
];

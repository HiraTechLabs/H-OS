import { describe, expect, it } from 'vitest';
import { ForbiddenError, PermissionService } from '@h-os/kernel';
import type { Actor } from '@h-os/kernel';
import { Permission } from '@h-os/contracts';
import type { PermissionGrant } from '@h-os/contracts';
import { HrActorScopeService } from '../../src/application/hr-actor-scope.service.js';
import type {
  EmployeeRepository,
  OrganizationDirectoryRepository,
} from '../../src/application/ports.js';

const ORG = '00000000-0000-4000-8000-000000000001';
const SELF_EMPLOYEE = '00000000-0000-4000-8000-0000000000a1';
const OTHER_EMPLOYEE = '00000000-0000-4000-8000-0000000000b2';

function actorWith(grants: readonly PermissionGrant[]): Actor {
  return {
    accountId: 'account-1',
    organizationId: ORG,
    displayName: 'Test account',
    email: 'test@h-os.local',
    locale: 'en',
    roles: ['test'],
    grants,
    sessionId: 'session-1',
  };
}

const employees = {
  findIdByAccount: async (organizationId: string, accountId: string) =>
    organizationId === ORG && accountId === 'account-1' ? SELF_EMPLOYEE : null,
} as unknown as EmployeeRepository;

const directory = {
  currentOrgUnitPath: async (employeeId: string) => {
    if (employeeId === SELF_EMPLOYEE) return 'hq.ops';
    if (employeeId === OTHER_EMPLOYEE) return 'hq.ops.payroll';
    return null;
  },
} as unknown as OrganizationDirectoryRepository;

const service = new HrActorScopeService(
  new PermissionService(),
  employees,
  directory,
);

describe('HR actor scope', () => {
  it('resolves the caller employee and current org path from HR data', async () => {
    const identity = await service.identityOf(actorWith([]));
    expect(identity).toEqual({ employeeId: SELF_EMPLOYEE, orgUnitPath: 'hq.ops' });
  });

  it('returns an empty identity when the account is not linked to an employee', async () => {
    const identity = await service.identityOf({
      ...actorWith([]),
      accountId: 'unlinked-account',
    });
    expect(identity).toEqual({ employeeId: null, orgUnitPath: null });
  });

  it('denies a permission that was not granted', async () => {
    await expect(
      service.assertCanAccess(actorWith([]), Permission.HR_EMPLOYEE_READ, SELF_EMPLOYEE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets an all-scope grant read any employee without loading identity', async () => {
    const level = await service.assertCanAccess(
      actorWith([{ permission: Permission.HR_EMPLOYEE_READ, scope: 'all' }]),
      Permission.HR_EMPLOYEE_READ,
      OTHER_EMPLOYEE,
    );
    expect(level).toBe('all');
  });

  it('lets own scope read only the linked employee record', async () => {
    const actor = actorWith([{ permission: Permission.HR_EMPLOYEE_READ, scope: 'own' }]);
    await expect(
      service.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, SELF_EMPLOYEE),
    ).resolves.toBe('own');
    await expect(
      service.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, OTHER_EMPLOYEE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets unit scope read only the exact organization unit', async () => {
    const actor = actorWith([{ permission: Permission.HR_EMPLOYEE_READ, scope: 'unit' }]);
    await expect(
      service.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, SELF_EMPLOYEE),
    ).resolves.toBe('unit');
    await expect(
      service.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, OTHER_EMPLOYEE),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('lets subtree scope read descendants but not ancestors or siblings', async () => {
    const actor = actorWith([{ permission: Permission.HR_EMPLOYEE_READ, scope: 'subtree' }]);
    await expect(
      service.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, OTHER_EMPLOYEE),
    ).resolves.toBe('subtree');
    const ancestorEmployee = '00000000-0000-4000-8000-0000000000c3';
    const ancestorDirectory = {
      currentOrgUnitPath: async (employeeId: string) =>
        employeeId === ancestorEmployee ? 'hq' : 'hq.ops.payroll',
    } as unknown as OrganizationDirectoryRepository;
    const ancestorService = new HrActorScopeService(
      new PermissionService(),
      employees,
      ancestorDirectory,
    );
    await expect(
      ancestorService.assertCanAccess(actor, Permission.HR_EMPLOYEE_READ, ancestorEmployee),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('requires organization-wide scope to change structure-wide configuration', async () => {
    const subtree = actorWith([{ permission: Permission.HR_ORGANIZATION_MANAGE, scope: 'subtree' }]);
    await expect(
      service.assertOrganizationWide(subtree, Permission.HR_ORGANIZATION_MANAGE),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.assertOrganizationWide(
        actorWith([{ permission: Permission.HR_ORGANIZATION_MANAGE, scope: 'all' }]),
        Permission.HR_ORGANIZATION_MANAGE,
      ),
    ).resolves.toBeUndefined();
  });

  it('allows a subtree grant only for units inside the caller subtree', async () => {
    const actor = actorWith([{ permission: Permission.HR_ORGANIZATION_MANAGE, scope: 'subtree' }]);
    await expect(
      service.assertUnitWithinScope(actor, Permission.HR_ORGANIZATION_MANAGE, 'hq.ops.payroll'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertUnitWithinScope(actor, Permission.HR_ORGANIZATION_MANAGE, 'hq.finance'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

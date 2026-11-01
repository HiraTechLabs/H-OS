import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  ALL_PERMISSIONS,
  Permission,
  RoleCode,
} from '@h-os/contracts';
import type { ScopeLevel } from '@h-os/contracts';
import type { AuthProvider, AppConfig, Database, DbExecutor, IdGenerator } from '@h-os/kernel';

export interface RoleDefinition {
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly grants: readonly { readonly permission: string; readonly scope: ScopeLevel }[];
}

const hrAdminGrants = ALL_PERMISSIONS.map((permission) => ({ permission, scope: 'all' as const }));

/**
 * Least-privilege starting roles (SEC-002). `hr_admin` is organization-wide by design; every
 * other role is bounded by the org tree. Payroll roles are intentionally absent until the payroll
 * phase is approved (HR-DEC-0002).
 */
export const DEFAULT_ROLES: readonly RoleDefinition[] = [
  {
    code: RoleCode.HR_ADMIN,
    nameEn: 'HR administrator',
    nameAr: 'مدير الموارد البشرية',
    grants: hrAdminGrants,
  },
  {
    code: RoleCode.HR_OFFICER,
    nameEn: 'HR officer',
    nameAr: 'أخصائي موارد بشرية',
    grants: [
      { permission: Permission.HR_EMPLOYEE_READ, scope: 'subtree' },
      { permission: Permission.HR_EMPLOYEE_READ_SENSITIVE, scope: 'subtree' },
      { permission: Permission.HR_EMPLOYEE_CREATE, scope: 'subtree' },
      { permission: Permission.HR_EMPLOYEE_UPDATE, scope: 'subtree' },
      { permission: Permission.HR_EMPLOYEE_CHANGE_STATUS, scope: 'subtree' },
      { permission: Permission.HR_ORGANIZATION_READ, scope: 'all' },
      { permission: Permission.HR_ORGANIZATION_MANAGE, scope: 'subtree' },
      { permission: Permission.HR_AUDIT_READ, scope: 'subtree' },
    ],
  },
  {
    code: RoleCode.MANAGER,
    nameEn: 'Manager',
    nameAr: 'مدير',
    grants: [
      { permission: Permission.HR_EMPLOYEE_READ, scope: 'subtree' },
      { permission: Permission.HR_ORGANIZATION_READ, scope: 'all' },
    ],
  },
  {
    code: RoleCode.EMPLOYEE,
    nameEn: 'Employee',
    nameAr: 'موظف',
    grants: [
      { permission: Permission.HR_EMPLOYEE_READ, scope: 'own' },
      { permission: Permission.HR_ORGANIZATION_READ, scope: 'all' },
    ],
  },
  {
    code: RoleCode.AUDITOR,
    nameEn: 'Auditor',
    nameAr: 'مدقق',
    grants: [
      { permission: Permission.HR_EMPLOYEE_READ, scope: 'all' },
      { permission: Permission.HR_AUDIT_READ, scope: 'all' },
      { permission: Permission.HR_ORGANIZATION_READ, scope: 'all' },
    ],
  },
];

const PERMISSION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  [Permission.HR_EMPLOYEE_READ]: 'Read employee records within the granted data scope',
  [Permission.HR_EMPLOYEE_READ_SENSITIVE]: 'Read identity, contact and document sections of a profile',
  [Permission.HR_EMPLOYEE_CREATE]: 'Create employee records',
  [Permission.HR_EMPLOYEE_UPDATE]: 'Update employee records and effective-dated assignments',
  [Permission.HR_EMPLOYEE_CHANGE_STATUS]: 'Change employment lifecycle status',
  [Permission.HR_EMPLOYEE_EXPORT]: 'Export employee data',
  [Permission.HR_ORGANIZATION_READ]: 'Read branches, locations, units, job catalogue and schedules',
  [Permission.HR_ORGANIZATION_MANAGE]: 'Manage organization structure and reference data',
  [Permission.HR_AUDIT_READ]: 'Read the audit trail',
  [Permission.PLATFORM_ACCOUNT_MANAGE]: 'Manage platform login accounts',
  [Permission.PLATFORM_INTEGRATION_RETRY]: 'Retry failed integration events',
};

export interface SeedResult {
  readonly organizationId: string;
  readonly adminAccountId: string;
  readonly permissionCount: number;
  readonly roleCount: number;
}

async function query<T>(executor: DbExecutor, statement: SQL): Promise<T[]> {
  const result = await executor.execute(statement);
  return [...(result as unknown as T[])];
}

/**
 * Idempotent platform bootstrap. It provisions exactly one organization, the permission
 * catalogue, the default roles and the first administrator account. The administrator password is
 * only written when the account is created, so re-running the seeder never silently resets a
 * credential.
 */
export async function seedPlatform(
  db: Database,
  config: AppConfig,
  ids: IdGenerator,
  auth: AuthProvider,
): Promise<SeedResult> {
  const passwordHash = await auth.hash(config.bootstrapAdmin.password);

  return db.transaction(async (tx) => {
    const [organization] = await query<{ id: string }>(
      tx,
      sql`
        insert into platform.organization (id, code, name_en, name_ar, time_zone)
        values (
          ${ids.uuid()},
          ${config.organization.code},
          ${config.organization.nameEn},
          ${config.organization.nameAr},
          ${config.organization.timeZone}
        )
        on conflict (code) do update
          set name_en = excluded.name_en,
              name_ar = excluded.name_ar,
              time_zone = excluded.time_zone,
              updated_at = now()
        returning id
      `,
    );
    if (!organization) {
      throw new Error('Could not provision the organization.');
    }

    for (const permission of ALL_PERMISSIONS) {
      await query(
        tx,
        sql`
          insert into platform.permission (code, description)
          values (${permission}, ${PERMISSION_DESCRIPTIONS[permission] ?? permission})
          on conflict (code) do update set description = excluded.description
        `,
      );
    }

    const roleIds = new Map<string, string>();

    for (const definition of DEFAULT_ROLES) {
      const [roleRow] = await query<{ id: string }>(
        tx,
        sql`
          insert into platform.role (id, organization_id, code, name_en, name_ar, is_system)
          values (
            ${ids.uuid()},
            ${organization.id},
            ${definition.code},
            ${definition.nameEn},
            ${definition.nameAr},
            true
          )
          on conflict (organization_id, code) do update
            set name_en = excluded.name_en,
                name_ar = excluded.name_ar,
                is_system = true
          returning id
        `,
      );
      if (!roleRow) {
        throw new Error(`Could not provision the role ${definition.code}.`);
      }
      roleIds.set(definition.code, roleRow.id);

      // Grants are replaced so the catalogue stays exactly as declared, never accumulating
      // stale permissions across releases.
      await query(
        tx,
        sql`delete from platform.role_permission where role_id = ${roleRow.id}`,
      );
      for (const grant of definition.grants) {
        await query(
          tx,
          sql`
            insert into platform.role_permission (role_id, permission_code, scope)
            values (${roleRow.id}, ${grant.permission}, ${grant.scope})
            on conflict (role_id, permission_code) do update set scope = excluded.scope
          `,
        );
      }
    }

    const hrAdminRoleId = roleIds.get(RoleCode.HR_ADMIN);
    if (!hrAdminRoleId) {
      throw new Error('The HR administrator role was not provisioned.');
    }
    const adminAccountId = await assignAdminRole(
      tx,
      organization.id,
      config,
      passwordHash,
      ids,
      hrAdminRoleId,
    );

    return {
      organizationId: organization.id,
      adminAccountId,
      permissionCount: ALL_PERMISSIONS.length,
      roleCount: DEFAULT_ROLES.length,
    };
  });
}

async function assignAdminRole(
  tx: DbExecutor,
  organizationId: string,
  config: AppConfig,
  passwordHash: string,
  ids: IdGenerator,
  roleId: string,
): Promise<string> {
  const email = config.bootstrapAdmin.email.toLowerCase();
  const [existing] = await query<{ id: string; organization_id: string }>(
    tx,
    sql`select id, organization_id from platform.account where email = ${email}`,
  );

  let accountId: string;
  if (existing) {
    if (existing.organization_id !== organizationId) {
      throw new Error(
        `The bootstrap account ${email} already belongs to a different organization.`,
      );
    }
    accountId = existing.id;
  } else {
    accountId = ids.uuid();
    await query(
      tx,
      sql`
        insert into platform.account (
          id, organization_id, email, display_name, password_hash, locale, status
        )
        values (
          ${accountId},
          ${organizationId},
          ${email},
          ${'Platform administrator'},
          ${passwordHash},
          'en',
          'active'
        )
      `,
    );
  }

  await query(
    tx,
    sql`
      insert into platform.account_role (account_id, role_id)
      values (${accountId}, ${roleId})
      on conflict (account_id, role_id) do nothing
    `,
  );

  return accountId;
}

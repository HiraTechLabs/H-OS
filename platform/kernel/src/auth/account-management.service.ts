import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@h-os/contracts';
import { and, asc, eq } from 'drizzle-orm';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors.js';
import { PermissionService } from '../rbac/permission.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from './session.service.js';
import { AUTH_PROVIDER } from './auth-provider.js';
import type { AuthProvider } from './auth-provider.js';
import { ID_GENERATOR } from '../clock.js';
import type { IdGenerator } from '../clock.js';
import { DATABASE } from '../db/database.provider.js';
import type { Transaction, Database } from '../db/client.js';
import { account, accountRole, role } from '../db/schema.js';
import type { Actor } from './actor.js';

export interface ManagedAccount {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: 'active' | 'suspended' | 'disabled';
  readonly roles: string[];
}

export interface CreateAccountInput {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly locale: 'en' | 'ar';
  readonly roles: readonly string[];
}

/**
 * The minimum account administration surface (DEC-0003: RBAC account tables belong to the
 * kernel; SEC-002/SEC-007/SEC-014):
 *
 * - every operation requires `platform.account.manage` held organization-wide, because login
 *   accounts, roles and their grants have no per-unit meaning;
 * - every operation is confined to the caller's organization;
 * - the caller can never modify their own account's roles, status or lock state, so the last
 *   administrator cannot lock themselves out and cannot change their own privilege;
 * - records, role grants/revocations, disabling and relink-time credentials never reach the
 *   audit trail: only emails, display names and role codes are stored there (SEC-007, LOG-003).
 *
 * Role assignment policy beyond the guards above (who may grant which role) is organization
 * policy, not code: see the limitations in the hardening worklog.
 */
@Injectable()
export class AccountManagementService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(AUTH_PROVIDER) private readonly auth: AuthProvider,
    @Inject(PermissionService) private readonly permissions: PermissionService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  private assertAdministration(actor: Actor): void {
    const scope = this.permissions.require(actor, Permission.PLATFORM_ACCOUNT_MANAGE);
    if (scope !== 'all') {
      throw new ForbiddenError('Login-account administration is organization-wide.');
    }
  }

  private assertNotSelf(actor: Actor, accountId: string): void {
    if (actor.accountId === accountId) {
      throw new ForbiddenError('You cannot administer your own login account.');
    }
  }

  /** Lists the login accounts of the caller's organization with their role codes. */
  async list(actor: Actor): Promise<readonly ManagedAccount[]> {
    this.assertAdministration(actor);

    const rows = await this.db
      .select({
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        status: account.status,
        roleCode: role.code,
      })
      .from(account)
      .leftJoin(accountRole, eq(accountRole.accountId, account.id))
      .leftJoin(role, eq(role.id, accountRole.roleId))
      .where(eq(account.organizationId, actor.organizationId))
      .orderBy(asc(account.email), asc(role.code));

    const accounts = new Map<string, ManagedAccount>();
    for (const row of rows) {
      const current = accounts.get(row.id);
      if (current) {
        if (row.roleCode) current.roles.push(row.roleCode);
        continue;
      }
      accounts.set(row.id, {
        accountId: row.id,
        email: row.email,
        displayName: row.displayName,
        status: row.status,
        roles: row.roleCode ? [row.roleCode] : [],
      });
    }
    return [...accounts.values()];
  }

  async create(actor: Actor, input: CreateAccountInput): Promise<string> {
    this.assertAdministration(actor);

    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.auth.hash(input.password);
    const accountId = this.ids.uuid();

    await this.db
      .transaction(async (tx) => {
        await tx.insert(account).values({
          id: accountId,
          organizationId: actor.organizationId,
          email,
          displayName: input.displayName.trim(),
          passwordHash,
          locale: input.locale,
          status: 'active',
        });

        const granted: string[] = [];
        for (const roleCode of input.roles) {
          const [roleRow] = await tx
            .select({ id: role.id, code: role.code })
            .from(role)
            .where(and(eq(role.organizationId, actor.organizationId), eq(role.code, roleCode)))
            .limit(1);
          if (!roleRow) {
            throw new NotFoundError(`The role '${roleCode}' does not exist in this organization.`);
          }
          await tx
            .insert(accountRole)
            .values({ accountId, roleId: roleRow.id })
            .onConflictDoNothing();
          granted.push(roleRow.code);
        }

        await this.audit.record(tx, actor, actor.organizationId, {
          action: 'platform.account.created',
          subject: { app: 'platform', type: 'account', id: accountId },
          after: { email, displayName: input.displayName.trim(), status: 'active', roles: granted },
        });
      })
      .catch((error: unknown) => {
        // The unique index is the authority; a concurrent create of the same email is still a
        // conflict, never a leaked constraint error.
        if (this.isUniqueViolation(error)) {
          throw new ConflictError('An account already exists for this email address.');
        }
        throw error;
      });

    return accountId;
  }

  async assignRole(actor: Actor, accountId: string, roleCode: string): Promise<void> {
    this.assertAdministration(actor);
    await this.changeRole(actor, accountId, roleCode, 'platform.account.role_assigned', true);
  }

  async revokeRole(actor: Actor, accountId: string, roleCode: string): Promise<void> {
    this.assertAdministration(actor);
    await this.changeRole(actor, accountId, roleCode, 'platform.account.role_revoked', false);
  }

  /** Disables the account and revokes all of its sessions inside the same transaction. */
  async disable(actor: Actor, accountId: string): Promise<void> {
    this.assertAdministration(actor);
    this.assertNotSelf(actor, accountId);
    const target = await this.loadTarget(actor, accountId);

    await this.db.transaction(async (tx) => {
      await tx
        .update(account)
        .set({ status: 'disabled' })
        .where(and(eq(account.id, accountId), eq(account.organizationId, actor.organizationId)));
      await this.sessions.revokeAllForAccountWithin(tx, accountId);
      await this.audit.record(tx, actor, actor.organizationId, {
        action: 'platform.account.disabled',
        subject: { app: 'platform', type: 'account', id: accountId },
        before: { status: target.status },
        after: { status: 'disabled' },
      });
    });
  }

  private async changeRole(
    actor: Actor,
    accountId: string,
    roleCode: string,
    action: string,
    grant: boolean,
  ): Promise<void> {
    this.assertNotSelf(actor, accountId);
    await this.loadTarget(actor, accountId);

    await this.db.transaction(async (tx) => {
      const [roleRow] = await tx
        .select({ id: role.id, code: role.code })
        .from(role)
        .where(and(eq(role.organizationId, actor.organizationId), eq(role.code, roleCode)))
        .limit(1);
      if (!roleRow) {
        throw new NotFoundError(`The role '${roleCode}' does not exist in this organization.`);
      }

      const before = await this.rolesOf(tx, accountId);
      if (grant) {
        await tx
          .insert(accountRole)
          .values({ accountId, roleId: roleRow.id })
          .onConflictDoNothing();
      } else {
        await tx
          .delete(accountRole)
          .where(and(eq(accountRole.accountId, accountId), eq(accountRole.roleId, roleRow.id)));
      }
      const after = await this.rolesOf(tx, accountId);

      await this.audit.record(tx, actor, actor.organizationId, {
        action,
        subject: { app: 'platform', type: 'account', id: accountId },
        before: { roles: before },
        after: { roleCode, roles: after },
      });
    });
  }

  private async loadTarget(
    actor: Actor,
    accountId: string,
  ): Promise<{ organizationId: string; status: string }> {
    const [row] = await this.db
      .select({ organizationId: account.organizationId, status: account.status })
      .from(account)
      .where(eq(account.id, accountId))
      .limit(1);
    if (!row || row.organizationId !== actor.organizationId) {
      throw new NotFoundError('The login account does not exist.');
    }
    return row;
  }

  private async rolesOf(
    executor: Transaction,
    accountId: string,
  ): Promise<string[]> {
    const rows = await executor
      .select({ code: role.code })
      .from(accountRole)
      .innerJoin(role, eq(role.id, accountRole.roleId))
      .where(eq(accountRole.accountId, accountId))
      .orderBy(asc(role.code));
    return rows.map((row) => row.code);
  }

  private isUniqueViolation(error: unknown): boolean {
    // Drizzle wraps driver errors, so the Postgres `23505` code can sit on the surface error or
    // anywhere in its `cause` chain.
    let current: unknown = error;
    while (current instanceof Error) {
      if ((current as { code?: unknown }).code === '23505') {
        return true;
      }
      current = (current as { cause?: unknown }).cause;
    }
    return false;
  }
}

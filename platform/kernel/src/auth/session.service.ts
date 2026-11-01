import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import type { PermissionGrant, ScopeLevel } from '@h-os/contracts';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';
import { CLOCK, ID_GENERATOR } from '../clock.js';
import type { Clock, IdGenerator } from '../clock.js';
import type { Database, DbExecutor } from '../db/client.js';
import { DATABASE } from '../db/database.provider.js';
import { account, accountRole, role, rolePermission, session } from '../db/schema.js';
import { ForbiddenError, UnauthenticatedError } from '../errors.js';
import { AUTH_PROVIDER } from './auth-provider.js';
import type { AuthProvider } from './auth-provider.js';
import type { Actor } from './actor.js';

export const SESSION_COOKIE = 'h_os_session';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: Date;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Verifies credentials and issues a session. Failures are deliberately indistinguishable so the
   * endpoint cannot be used to enumerate accounts (SEC-011).
   */
  async authenticate(email: string, password: string): Promise<IssuedSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const [row] = await this.db
      .select()
      .from(account)
      .where(eq(account.email, normalizedEmail))
      .limit(1);

    if (!row) {
      // Constant-ish work so a missing account is not measurably faster than a wrong password.
      await this.authProvider.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZXg$0000000000000000000000000000000000000000000',
        password,
      );
      throw new UnauthenticatedError('Email or password is incorrect.');
    }

    if (row.lockedUntil && row.lockedUntil.getTime() > this.clock.now().getTime()) {
      throw new ForbiddenError('This account is temporarily locked. Try again later.');
    }

    if (row.status !== 'active') {
      throw new ForbiddenError('This account is not active.');
    }

    const valid = await this.authProvider.verify(row.passwordHash, password);
    if (!valid) {
      await this.registerFailedAttempt(row.id);
      throw new UnauthenticatedError('Email or password is incorrect.');
    }

    const now = this.clock.now();
    await this.db
      .update(account)
      .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now })
      .where(eq(account.id, row.id));

    return this.issue(row.id);
  }

  private async registerFailedAttempt(accountId: string): Promise<void> {
    // The counter is incremented and the lock decided in one statement: concurrent failures
    // cannot lose counts and every racer sees the same lock threshold. The instant travels as an
    // ISO string with an explicit `::timestamptz` cast: a Date embedded in a raw `sql` template
    // bypasses the column serializers (postgres.js cannot bind a Date object) and a bare text
    // parameter is refused by timestamptz assignment targets.
    const lockedAt = new Date(this.clock.now().getTime() + LOCK_DURATION_MS).toISOString();
    await this.db
      .update(account)
      .set({
        failedLoginAttempts: sql`${account.failedLoginAttempts} + 1`,
        lockedUntil: sql`case when ${account.failedLoginAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} then ${lockedAt}::timestamptz else null end`,
      })
      .where(eq(account.id, accountId));
  }

  private async issue(accountId: string): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlMinutes * 60 * 1000);
    await this.db.insert(session).values({
      id: this.ids.uuid(),
      accountId,
      tokenHash: hashToken(token),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });
    return { token, expiresAt };
  }

  /** Resolves a session token to an actor, enforcing expiry and idle timeout. Returns null when invalid. */
  async resolve(token: string): Promise<Actor | null> {
    const now = this.clock.now();
    const [row] = await this.db
      .select()
      .from(session)
      .where(
        and(
          eq(session.tokenHash, hashToken(token)),
          isNull(session.revokedAt),
          gt(session.expiresAt, now),
        ),
      )
      .limit(1);

    if (!row) return null;

    const idleLimit = this.config.sessionIdleTimeoutMinutes * 60 * 1000;
    if (now.getTime() - row.lastSeenAt.getTime() > idleLimit) {
      await this.revokeById(row.id);
      return null;
    }

    const [accountRow] = await this.db
      .select()
      .from(account)
      .where(eq(account.id, row.accountId))
      .limit(1);

    if (!accountRow || accountRow.status !== 'active') {
      await this.revokeById(row.id);
      return null;
    }

    const grants = await this.loadGrants(accountRow.id);
    const roles = await this.loadRoles(accountRow.id);

    if (now.getTime() - row.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await this.db
        .update(session)
        .set({ lastSeenAt: now })
        .where(eq(session.id, row.id));
    }

    return {
      accountId: accountRow.id,
      organizationId: accountRow.organizationId,
      displayName: accountRow.displayName,
      email: accountRow.email,
      locale: accountRow.locale === 'ar' ? 'ar' : 'en',
      roles,
      grants,
      sessionId: row.id,
    };
  }

  private async loadRoles(accountId: string): Promise<readonly string[]> {
    const rows = await this.db
      .select({ code: role.code })
      .from(accountRole)
      .innerJoin(role, eq(role.id, accountRole.roleId))
      .where(eq(accountRole.accountId, accountId));
    return rows.map((row) => row.code);
  }

  private async loadGrants(accountId: string): Promise<readonly PermissionGrant[]> {
    const rows = await this.db
      .select({ permission: rolePermission.permissionCode, scope: rolePermission.scope })
      .from(accountRole)
      .innerJoin(rolePermission, eq(rolePermission.roleId, accountRole.roleId))
      .where(eq(accountRole.accountId, accountId));
    return rows.map((row) => ({
      permission: row.permission,
      scope: row.scope as ScopeLevel,
    }));
  }

  async revoke(token: string): Promise<void> {
    await this.db
      .update(session)
      .set({ revokedAt: this.clock.now() })
      .where(eq(session.tokenHash, hashToken(token)));
  }

  private async revokeById(sessionId: string): Promise<void> {
    await this.db
      .update(session)
      .set({ revokedAt: this.clock.now() })
      .where(eq(session.id, sessionId));
  }

  /**
   * Called when an org change or termination must take effect immediately (SEC-014).
   * Termination disables the account; a transfer only drops the stale scope.
   */
  async revokeAllForAccount(accountId: string, reason: string): Promise<void> {
    const result = await this.db
      .update(session)
      .set({ revokedAt: this.clock.now() })
      .where(and(eq(session.accountId, accountId), isNull(session.revokedAt)))
      .returning({ id: session.id });
    this.logger.log({
      event: 'sessions.revoked',
      accountId,
      reason,
      count: result.length,
    });
  }

  /**
   * Same revocation, inside the caller's transaction, so the state change and the session sweep
   * commit or fail together. No operational log: the audit record in the same transaction is the
   * evidence (LOG-006).
   */
  async revokeAllForAccountWithin(executor: DbExecutor, accountId: string): Promise<void> {
    await executor
      .update(session)
      .set({ revokedAt: this.clock.now() })
      .where(and(eq(session.accountId, accountId), isNull(session.revokedAt)));
  }

  /** Used by the bootstrap seeder and account management. */
  async disableAccount(accountId: string): Promise<void> {
    await this.db
      .update(account)
      .set({ status: 'disabled', updatedAt: this.clock.now() })
      .where(eq(account.id, accountId));
    await this.revokeAllForAccount(accountId, 'account_disabled');
  }

  async countActiveSessions(accountId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(session)
      .where(and(eq(session.accountId, accountId), isNull(session.revokedAt)));
    return row?.count ?? 0;
  }
}

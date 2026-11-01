import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Platform kernel schema. Owned by `@h-os/kernel`; no other app may read these tables
 * directly (ARCH-003). Business entities live in the owning app's schema.
 */
export const platformSchema = pgSchema('platform');

export const organization = platformSchema.table(
  'organization',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    timeZone: text('time_zone').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('organization_code_unique').on(table.code)],
);

export const ACCOUNT_STATUS = ['active', 'suspended', 'disabled'] as const;

export const account = platformSchema.table(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    locale: text('locale').notNull().default('en'),
    status: text('status', { enum: ACCOUNT_STATUS }).notNull().default('active'),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('account_email_unique').on(table.email)],
);

export const role = platformSchema.table(
  'role',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organization.id),
    code: text('code').notNull(),
    nameEn: text('name_en').notNull(),
    nameAr: text('name_ar').notNull(),
    isSystem: boolean('is_system').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('role_code_unique').on(table.organizationId, table.code)],
);

export const permission = platformSchema.table('permission', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
});

export const rolePermission = platformSchema.table(
  'role_permission',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permission.code),
    scope: text('scope', { enum: ['own', 'unit', 'subtree', 'all'] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionCode] })],
);

export const accountRole = platformSchema.table(
  'account_role',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.roleId] })],
);

export const session = platformSchema.table(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => account.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('session_token_hash_unique').on(table.tokenHash),
    index('session_account_idx').on(table.accountId),
    index('session_expires_idx').on(table.expiresAt),
  ],
);

export const auditRecord = platformSchema.table(
  'audit_record',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    actorAccountId: uuid('actor_account_id'),
    action: text('action').notNull(),
    subjectApp: text('subject_app').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    requestId: text('request_id').notNull(),
    traceId: text('trace_id').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_subject_idx').on(table.subjectApp, table.subjectType, table.subjectId),
    index('audit_occurred_idx').on(table.occurredAt),
  ],
);

export const outboxEvent = platformSchema.table(
  'outbox_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    type: text('type').notNull(),
    version: integer('version').notNull().default(1),
    subjectApp: text('subject_app').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    payload: jsonb('payload').notNull(),
    traceId: text('trace_id').notNull(),
    correlationId: text('correlation_id'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastErrorCode: text('last_error_code'),
  },
  (table) => [
    index('outbox_unpublished_idx')
      .on(table.occurredAt)
      .where(sql`${table.publishedAt} is null`),
  ],
);

export const entityLink = platformSchema.table(
  'entity_link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sourceApp: text('source_app').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    targetApp: text('target_app').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('entity_link_unique').on(
      table.sourceApp,
      table.sourceType,
      table.sourceId,
      table.targetApp,
      table.targetType,
      table.targetId,
    ),
    index('entity_link_target_idx').on(table.targetApp, table.targetType, table.targetId),
  ],
);

export type AccountRow = typeof account.$inferSelect;
export type RoleRow = typeof role.$inferSelect;
export type SessionRow = typeof session.$inferSelect;
export type OrganizationRow = typeof organization.$inferSelect;
export type OutboxEventRow = typeof outboxEvent.$inferSelect;

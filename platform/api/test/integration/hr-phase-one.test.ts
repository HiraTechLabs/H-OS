import 'reflect-metadata';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {
  CryptoIdGenerator,
  LocalAuthProvider,
  createCsrfOriginGuard,
  createDatabase,
  loadConfig,
  requestContextMiddleware,
  securityHeadersMiddleware,
} from '@h-os/kernel';
import type { AppConfig, DatabaseHandle } from '@h-os/kernel';
import { AppModule } from '../../src/app.module.js';
import { seedPlatform } from '../../src/bootstrap/seed.js';

type ApiResult = {
  readonly status: number;
  readonly body: Record<string, unknown> | null;
  readonly cookie: string | null;
};

const ROOT = resolve(process.cwd(), '..', '..');
const KERNEL_MIGRATIONS = resolve(ROOT, 'platform/kernel/migrations');
const HR_MIGRATIONS = resolve(ROOT, 'apps/hr/api/migrations');

const ADMIN_EMAIL = 'admin@h-os.local';
const ADMIN_PASSWORD = 'ChangeThis-Local-Dev-Only-1';
const SELF_PASSWORD = 'Employee-Local-Dev-Only-1';

let container: StartedPostgreSqlContainer;
let handle: DatabaseHandle;
let app: INestApplication;
let baseUrl: string;
let config: AppConfig;
let adminCookie: string;

const state: {
  branchId?: string;
  locationId?: string;
  unitId?: string;
  teamId?: string;
  titleId?: string;
  gradeId?: string;
  scheduleId?: string;
  employeeA?: { id: string; employeeNumber: string };
  employeeB?: { id: string; employeeNumber: string };
  selfAccountId?: string;
  selfCookie?: string;
  officerAccountId?: string;
} = {};

async function api(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string; origin?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.cookie) headers.cookie = options.cookie;
  if (options.origin) headers.origin = options.origin;
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  const setCookie = response.headers.getSetCookie();
  return {
    status: response.status,
    body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : null,
    cookie: setCookie.find((entry) => entry.startsWith('h_os_session='))?.split(';')[0] ?? null,
  };
}

async function login(email: string, password: string): Promise<string> {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  expect(result.cookie).not.toBeNull();
  return result.cookie as string;
}

function name(en: string, ar: string): { en: string; ar: string } {
  return { en, ar };
}

function employeeBody(nationalId: string, workEmail: string, startDate: string) {
  return {
    name: {
      givenEn: 'Sara',
      familyEn: 'Ali',
      givenAr: 'سارة',
      familyAr: 'علي',
    },
    personal: {
      dateOfBirth: '1990-01-01',
      gender: 'female',
      nationality: 'SAU',
      nationalId,
      passportNumber: null,
    },
    contact: {
      workEmail,
      personalEmail: null,
      phone: '+966500000000',
      city: 'Riyadh',
    },
    employment: {
      employmentType: 'permanent',
      startDate,
      probationEndDate: null,
      contract: null,
    },
    assignment: {
      branchId: state.branchId,
      workLocationId: state.locationId,
      orgUnitId: state.teamId,
      jobTitleId: state.titleId,
      jobGradeId: state.gradeId,
      workArrangement: 'office',
      workScheduleId: state.scheduleId,
      costCenterRef: 'CC-100',
    },
    managerEmployeeId: null,
    accountId: null,
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16.9-alpine')
    .withDatabase('h_os_test')
    .withUsername('h_os')
    .withPassword('h_os')
    .start();

  const url = container.getConnectionUri();
  const migrationClient = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    const migrationDb = drizzle(migrationClient);
    // Kernel first, then H-HR with its own journal exactly like the operational scripts.
    await migrate(migrationDb, { migrationsFolder: KERNEL_MIGRATIONS });
    await migrate(migrationDb, {
      migrationsFolder: HR_MIGRATIONS,
      migrationsTable: '__drizzle_migrations_hr',
    });
  } finally {
    await migrationClient.end({ timeout: 5 });
  }

  config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    PORT: '3000',
    API_BASE_URL: 'http://127.0.0.1:3000/api/v1',
    DATABASE_URL: url,
    CORS_ORIGINS: '',
    SESSION_SECRET: 'integration-test-session-secret-at-least-32-chars',
    LOG_LEVEL: 'silent',
    BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
    ORGANIZATION_CODE: 'HOS-TEST',
    ORGANIZATION_NAME_EN: 'HiraTech Labs',
    ORGANIZATION_NAME_AR: 'هيرا تك لابس',
    ORGANIZATION_TIMEZONE: 'Asia/Riyadh',
    FIELD_ENCRYPTION_KEY:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  });

  handle = createDatabase(config.databaseUrl, { max: 5 });
  await seedPlatform(handle.db, config, new CryptoIdGenerator(), new LocalAuthProvider());

  app = await NestFactory.create(AppModule.forRoot(config), {
    logger: false,
    bodyParser: true,
  });
  app.use(requestContextMiddleware);
  // Mirrors the composition in `main.ts` so the transport shield is exercised end to end.
  app.use(securityHeadersMiddleware);
  app.use(createCsrfOriginGuard(config));
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await handle?.close();
  await container?.stop();
});

describe('H-HR Phase One HTTP surface', () => {
  it('serves health publicly and rejects unauthenticated business requests', async () => {
    const health = await api('/health');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'ok', database: 'up' });

    const denied = await api('/employees');
    expect(denied.status).toBe(401);
    expect(denied.body).toMatchObject({ code: 'unauthenticated' });
  });

  it('authenticates the bootstrap administrator with an HttpOnly cookie', async () => {
    const result = await api('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(result.status).toBe(200);
    const user = result.body?.user as Record<string, unknown>;
    expect(user.email).toBe(ADMIN_EMAIL);
    expect(user.roles).toEqual(['hr_admin']);
    expect((user.grants as unknown[]).length).toBeGreaterThanOrEqual(11);
    expect(result.cookie).toContain('h_os_session=');
    adminCookie = result.cookie as string;

    const me = await api('/auth/me', { cookie: adminCookie });
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: ADMIN_EMAIL });
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const wrong = await api('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: 'definitely-the-wrong-password' },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toMatchObject({ code: 'unauthenticated' });

    const unknown = await api('/auth/login', {
      method: 'POST',
      body: { email: 'nobody@h-os.local', password: 'definitely-the-wrong-password' },
    });
    expect(unknown.status).toBe(401);
    expect(unknown.body?.detail).toBe(wrong.body?.detail);
  });

  it('creates the organization structure and protects it with authorization', async () => {
    const branch = await api('/organization/branches', {
      method: 'POST',
      cookie: adminCookie,
      body: { code: 'HQ', name: name('Head Office', 'المكتب الرئيسي'), timeZone: 'Asia/Riyadh' },
    });
    expect(branch.status, JSON.stringify(branch.body)).toBe(201);
    state.branchId = branch.body?.id as string;

    const duplicateBranch = await api('/organization/branches', {
      method: 'POST',
      cookie: adminCookie,
      body: { code: 'HQ', name: name('Head Office', 'المكتب الرئيسي'), timeZone: 'Asia/Riyadh' },
    });
    expect(duplicateBranch.status).toBe(409);
    expect(duplicateBranch.body).toMatchObject({ code: 'conflict' });

    const location = await api('/organization/locations', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        branchId: state.branchId,
        code: 'HQ-MAIN',
        name: name('Main Site', 'الموقع الرئيسي'),
        addressLine: 'King Fahd Road',
        timeZone: 'Asia/Riyadh',
      },
    });
    expect(location.status, JSON.stringify(location.body)).toBe(201);
    state.locationId = location.body?.id as string;

    const unit = await api('/organization/org-units', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        branchId: state.branchId,
        parentId: null,
        kind: 'department',
        code: 'OPS',
        name: name('Operations', 'العمليات'),
      },
    });
    expect(unit.status, JSON.stringify(unit.body)).toBe(201);
    state.unitId = unit.body?.id as string;
    expect(unit.body?.path).toBe('ops');

    const team = await api('/organization/org-units', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        branchId: state.branchId,
        parentId: state.unitId,
        kind: 'team',
        code: 'OPS-PAY',
        name: name('Payroll', 'الرواتب'),
      },
    });
    expect(team.status, JSON.stringify(team.body)).toBe(201);
    state.teamId = team.body?.id as string;
    expect(team.body?.path).toBe('ops.ops_pay');

    const title = await api('/organization/job-titles', {
      method: 'POST',
      cookie: adminCookie,
      body: { code: 'HR-MGR', name: name('HR Manager', 'مدير الموارد البشرية') },
    });
    expect(title.status).toBe(201);
    state.titleId = title.body?.id as string;

    const grade = await api('/organization/job-grades', {
      method: 'POST',
      cookie: adminCookie,
      body: { code: 'G1', name: name('Grade 1', 'الدرجة 1'), rank: 1 },
    });
    expect(grade.status).toBe(201);
    state.gradeId = grade.body?.id as string;

    const days = Array.from({ length: 7 }, (_, weekday) => {
      const rest = weekday === 5 || weekday === 6;
      return {
        weekday,
        isRestDay: rest,
        startLocal: rest ? null : '09:00',
        endLocal: rest ? null : '17:00',
        breakMinutes: rest ? 0 : 60,
        crossesMidnight: false,
      };
    });
    const schedule = await api('/organization/work-schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        code: 'STD',
        name: name('Standard week', 'أسبوع قياسي'),
        timeZone: 'Asia/Riyadh',
        days,
      },
    });
    expect(schedule.status, JSON.stringify(schedule.body)).toBe(201);
    state.scheduleId = schedule.body?.id as string;

    const incomplete = await api('/organization/work-schedules', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        code: 'BAD',
        name: name('Bad week', 'أسبوع غير مكتمل'),
        timeZone: 'Asia/Riyadh',
        days: days.slice(0, 6),
      },
    });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body).toMatchObject({ code: 'validation_failed' });

    const overview = await api('/organization', { cookie: adminCookie });
    expect(overview.status).toBe(200);
    const data = overview.body as Record<string, unknown[]>;
    expect(data.branches).toHaveLength(1);
    expect(data.orgUnits).toHaveLength(2);
    expect(data.jobTitles).toHaveLength(1);
    expect(data.jobGrades).toHaveLength(1);
    expect(data.workSchedules).toHaveLength(1);
    expect(data.locations).toHaveLength(1);
  });

  it('creates employees with server-derived numbers and statuses, refusing duplicates', async () => {
    const created = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: employeeBody('1234567890', 'sara.ali@h-os.local', '2020-01-01'),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body?.employeeNumber).toBe('EMP-00001');
    expect(created.body?.status).toBe('active');
    state.employeeA = {
      id: created.body?.employeeId as string,
      employeeNumber: created.body?.employeeNumber as string,
    };

    const future = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: employeeBody('1111111111', 'future.hire@h-os.local', '2099-01-01'),
    });
    expect(future.status, JSON.stringify(future.body)).toBe(201);
    expect(future.body?.status).toBe('pending_start');

    const duplicateNationalId = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: employeeBody('1234567890', 'other.email@h-os.local', '2020-01-01'),
    });
    expect(duplicateNationalId.status).toBe(409);
    expect(duplicateNationalId.body).toMatchObject({ code: 'conflict' });

    const duplicateEmail = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: employeeBody('2222222222', 'sara.ali@h-os.local', '2020-01-01'),
    });
    expect(duplicateEmail.status).toBe(409);

    const unknownUnit = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        ...employeeBody('3333333333', 'unknown.unit@h-os.local', '2020-01-01'),
        assignment: {
          ...employeeBody('3333333333', 'unknown.unit@h-os.local', '2020-01-01').assignment,
          orgUnitId: '00000000-0000-4000-8000-000000000000',
        },
      },
    });
    expect(unknownUnit.status).toBe(404);
  });

  it('lists, searches and masks the profile without exposing identity numbers', async () => {
    const list = await api('/employees?limit=10', { cookie: adminCookie });
    expect(list.status).toBe(200);
    const items = list.body?.items as Record<string, unknown>[];
    expect(items.length).toBe(2);
    const first = items.find((item) => item.employeeNumber === 'EMP-00001');
    expect(first?.displayName).toEqual({ en: 'Sara Ali', ar: 'سارة علي' });

    const search = await api('/employees?q=Sara&status=active', { cookie: adminCookie });
    expect(search.status).toBe(200);
    expect((search.body?.items as unknown[]).length).toBe(1);

    const repeated = await api('/employees?status=active&status=probation', {
      cookie: adminCookie,
    });
    expect(repeated.status).toBe(200);

    const commaSeparated = await api('/employees?status=active,probation', { cookie: adminCookie });
    expect(commaSeparated.status).toBe(200);

    const profile = await api(`/employees/${state.employeeA?.id}`, { cookie: adminCookie });
    expect(profile.status).toBe(200);
    const body = profile.body as Record<string, unknown>;
    const summary = body.summary as Record<string, unknown>;
    expect(summary.employeeNumber).toBe('EMP-00001');
    expect(summary.status).toBe('active');
    const identity = body.identity as Record<string, unknown>;
    expect(identity.nationalIdMasked).toBe('****7890');
    expect(identity.nationalIdMasked).not.toContain('123456');
    const org = body.organization as Record<string, unknown>;
    expect((org.currentAssignment as Record<string, unknown>).orgUnitName).toEqual({
      en: 'Payroll',
      ar: 'الرواتب',
    });
    expect(body.visibleSections).toContain('identity');
  });

  it('applies effective-dated updates without overwriting history', async () => {
    const employeeId = state.employeeA?.id as string;

    const update = await api(`/employees/${employeeId}`, {
      method: 'PATCH',
      cookie: adminCookie,
      body: { city: 'Jeddah' },
    });
    expect(update.status).toBe(204);

    const firstAssignment = await api(`/employees/${employeeId}/assignment`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        orgUnitId: state.unitId,
        workLocationId: state.locationId,
        jobTitleId: state.titleId,
        jobGradeId: state.gradeId,
        workArrangement: 'hybrid',
        workScheduleId: state.scheduleId,
        costCenterRef: 'CC-200',
        effectiveFrom: '2025-07-01',
        reason: 'Team transfer',
      },
    });
    expect(firstAssignment.status, JSON.stringify(firstAssignment.body)).toBe(204);

    const invalidAssignment = await api(`/employees/${employeeId}/assignment`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        orgUnitId: state.teamId,
        workLocationId: state.locationId,
        jobTitleId: state.titleId,
        jobGradeId: null,
        workArrangement: 'office',
        workScheduleId: null,
        costCenterRef: null,
        effectiveFrom: '2025-01-01',
        reason: 'Overlaps the closed range',
      },
    });
    expect(invalidAssignment.status).toBe(412);
    expect(invalidAssignment.body).toMatchObject({ code: 'precondition_failed' });

    const profile = await api(`/employees/${employeeId}`, { cookie: adminCookie });
    const org = (profile.body as Record<string, unknown>).organization as Record<string, unknown>;
    const assignments = org.assignments as Record<string, unknown>[];
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.validFrom).toBe('2020-01-01');
    // Effective ranges are half-open [validFrom, validTo): the predecessor ends the day the
    // successor starts, so no calendar day is covered twice or lost.
    expect(assignments[0]?.validTo).toBe('2025-07-01');
    expect(assignments[1]?.validFrom).toBe('2025-07-01');
    expect(assignments[1]?.validTo).toBeNull();
    expect(assignments[1]?.workArrangement).toBe('hybrid');
    expect((assignments[0]?.orgUnitName as Record<string, unknown>).en).toBe('Payroll');

    const timeline = (profile.body as Record<string, unknown>).timeline as Record<string, unknown>[];
    expect(timeline.some((entry) => entry.eventType === 'hr.assignment.changed.v1')).toBe(true);
    expect(timeline.some((entry) => entry.eventType === 'hr.employee.updated.v1')).toBe(true);
  });

  it('changes the reporting manager and appends contacts and document references', async () => {
    const employeeId = state.employeeA?.id as string;

    const manager = await api(`/employees/${employeeId}/manager`, {
      method: 'POST',
      cookie: adminCookie,
      body: { managerEmployeeId: null, effectiveFrom: '2025-07-01', reason: 'No direct manager' },
    });
    expect(manager.status).toBe(204);

    const contact = await api(`/employees/${employeeId}/emergency-contacts`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: 'Omar Ali',
        relationship: 'Brother',
        phone: '+966500000001',
        priority: 1,
      },
    });
    expect(contact.status, JSON.stringify(contact.body)).toBe(201);
    expect(contact.body?.id).toBeTypeOf('string');

    const document = await api(`/employees/${employeeId}/documents`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        archiveDocumentId: 'arc-doc-1',
        documentType: 'contract',
        classification: 'confidential',
        issuedOn: '2020-01-01',
        expiresOn: null,
      },
    });
    expect(document.status, JSON.stringify(document.body)).toBe(201);

    const profile = await api(`/employees/${employeeId}`, { cookie: adminCookie });
    const body = profile.body as Record<string, unknown>;
    expect((body.documents as unknown[]).length).toBe(1);
    expect((body.employment as Record<string, unknown>).episodes).toHaveLength(1);
    expect(body.visibleSections).toContain('documents');
  });

  it('enforces employee data scope for a self-service account', async () => {
    const employeeA = state.employeeA as { id: string; employeeNumber: string };
    const employeeBResult = await api('/employees', {
      method: 'POST',
      cookie: adminCookie,
      body: employeeBody('9876543210', 'noor.hassan@h-os.local', '2020-01-01'),
    });
    expect(employeeBResult.status).toBe(201);
    state.employeeB = {
      id: employeeBResult.body?.employeeId as string,
      employeeNumber: employeeBResult.body?.employeeNumber as string,
    };

    // Accounts are provisioned through the new platform account API and linked through the
    // audited H-HR operation — no direct SQL anywhere in the product flow.
    const createdAccount = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'sara.self@h-os.local',
        displayName: 'Sara Ali',
        password: SELF_PASSWORD,
        locale: 'en',
        roles: ['employee'],
      },
    });
    expect(createdAccount.status, JSON.stringify(createdAccount.body)).toBe(201);
    const accountId = createdAccount.body?.accountId as string;
    expect(accountId).toBeTypeOf('string');
    state.selfAccountId = accountId;

    const linked = await api(`/employees/${employeeA.id}/account-link`, {
      method: 'POST',
      cookie: adminCookie,
      body: { accountId },
    });
    expect(linked.status, JSON.stringify(linked.body)).toBe(204);

    state.selfCookie = await login('sara.self@h-os.local', SELF_PASSWORD);

    const me = await api('/employees/me', { cookie: state.selfCookie });
    expect(me.status).toBe(200);
    expect((me.body?.summary as Record<string, unknown>).employeeNumber).toBe(
      employeeA.employeeNumber,
    );

    const employeeB = state.employeeB as { id: string; employeeNumber: string };
    const other = await api(`/employees/${employeeB.id}`, { cookie: state.selfCookie });
    expect(other.status).toBe(403);
    expect(other.body).toMatchObject({ code: 'forbidden' });

    const ownList = await api('/employees?limit=10', { cookie: state.selfCookie });
    expect(ownList.status).toBe(200);
    const ownItems = ownList.body?.items as Record<string, unknown>[];
    expect(ownItems).toHaveLength(1);
    expect(ownItems[0]?.employeeNumber).toBe(employeeA.employeeNumber);

    const createDenied = await api('/organization/branches', {
      method: 'POST',
      cookie: state.selfCookie,
      body: { code: 'SELF', name: name('Self', 'ذاتي'), timeZone: 'Asia/Riyadh' },
    });
    expect(createDenied.status).toBe(403);
  });

  it('refuses illegal transitions and closes history when employment ends', async () => {
    const employeeId = state.employeeA?.id as string;

    const illegal = await api(`/employees/${employeeId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { toStatus: 'cancelled', effectiveDate: '2025-06-01', reason: 'Not allowed' },
    });
    expect(illegal.status).toBe(412);

    const rehire = await api(`/employees/${employeeId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { toStatus: 'pending_start', effectiveDate: '2025-06-01', reason: 'Not allowed' },
    });
    expect(rehire.status).toBe(400);
    expect(String(rehire.body?.detail)).toMatch(/rehire/i);

    const notice = await api(`/employees/${employeeId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        toStatus: 'notice_period',
        effectiveDate: '2025-06-01',
        reason: 'Resignation received',
      },
    });
    expect(notice.status, JSON.stringify(notice.body)).toBe(204);

    const missingReason = await api(`/employees/${employeeId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: { toStatus: 'terminated', effectiveDate: '2025-07-01' },
    });
    expect(missingReason.status).toBe(400);

    const terminated = await api(`/employees/${employeeId}/status`, {
      method: 'POST',
      cookie: adminCookie,
      body: {
        toStatus: 'terminated',
        effectiveDate: '2025-07-01',
        reason: 'End of notice',
        endReason: 'resignation',
      },
    });
    expect(terminated.status, JSON.stringify(terminated.body)).toBe(204);

    const profile = await api(`/employees/${employeeId}`, { cookie: adminCookie });
    const body = profile.body as Record<string, unknown>;
    expect((body.summary as Record<string, unknown>).status).toBe('terminated');
    const employment = body.employment as Record<string, unknown>;
    const episode = (employment.episodes as Record<string, unknown>[])[0];
    expect(episode?.endDate).toBe('2025-07-01');
    const org = body.organization as Record<string, unknown>;
    const assignments = org.assignments as Record<string, unknown>[];
    expect(assignments[assignments.length - 1]?.validTo).toBe('2025-07-01');
    expect(org.currentManager).toBeNull();

    // Ending employment revokes the linked account's sessions immediately (SEC-014).
    const revoked = await api('/employees/me', { cookie: state.selfCookie as string });
    expect(revoked.status).toBe(401);
  });

  it('records audited changes and outbox events without personal data', async () => {
    const employeeId = state.employeeA?.id as string;

    const auditRows = (await handle.db.execute(sql`
      select action, before, after, reason
      from platform.audit_record
      where subject_app = 'hr'
      order by occurred_at
    `)) as unknown as {
      action: string;
      before: unknown;
      after: unknown;
      reason: string | null;
    }[];
    const actions = auditRows.map((row) => row.action);
    for (const expected of [
      'hr.organization.branch_created',
      'hr.organization.location_created',
      'hr.organization.unit_created',
      'hr.organization.job_title_created',
      'hr.organization.job_grade_created',
      'hr.organization.work_schedule_created',
      'hr.employee.created',
      'hr.employee.updated',
      'hr.assignment.changed',
      'hr.manager.changed',
      'hr.employee.emergency_contact_added',
      'hr.employee.document_linked',
      'hr.employee.status_changed',
    ]) {
      expect(actions, expected).toContain(expected);
    }

    const serialized = JSON.stringify(auditRows);
    expect(serialized).not.toContain('1234567890');
    expect(serialized).not.toContain('9876543210');
    expect(serialized).not.toContain('Omar Ali');
    expect(serialized).not.toContain('+966500000001');
    expect(serialized).not.toContain(SELF_PASSWORD);
    expect(serialized).not.toContain(passwordHashMarker());

    const outboxRows = (await handle.db.execute(sql`
      select type, payload from platform.outbox_event order by occurred_at
    `)) as unknown as { type: string; payload: unknown }[];
    const types = outboxRows.map((row) => row.type);
    for (const expected of [
      'hr.employee.created.v1',
      'hr.employee.updated.v1',
      'hr.assignment.changed.v1',
      'hr.manager.changed.v1',
      'hr.employee.status-changed.v1',
    ]) {
      expect(types, expected).toContain(expected);
    }
    const outboxText = JSON.stringify(outboxRows);
    expect(outboxText).not.toContain('1234567890');
    expect(outboxText).not.toContain('9876543210');
    expect(outboxText).not.toContain('Omar Ali');

    const timelineRows = (await handle.db.execute(sql`
      select event_type from hr.employee_timeline where employee_id = ${employeeId}
    `)) as unknown as { event_type: string }[];
    expect(timelineRows.length).toBeGreaterThanOrEqual(5);
  });

  it('sets baseline secure headers on every response', async () => {
    const response = await fetch(`${baseUrl}`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
  });

  it('rejects cross-origin state-changing requests and accepts allowlisted ones', async () => {
    const attacker = await api('/auth/login', {
      method: 'POST',
      origin: 'https://attacker.example',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(attacker.status).toBe(403);
    expect(attacker.body).toMatchObject({ code: 'forbidden' });

    // apiBaseUrl (http://127.0.0.1:3000/api/v1) origin is always permitted; a wrong password on
    // the allowlisted origin still proves the request reached the credential check.
    const allowlisted = await api('/auth/login', {
      method: 'POST',
      origin: 'http://127.0.0.1:3000',
      body: { email: ADMIN_EMAIL, password: 'definitely-the-wrong-password' },
    });
    expect(allowlisted.status).toBe(401);
    expect(allowlisted.body).toMatchObject({ code: 'unauthenticated' });
  });

  it('creates, lists and rejects duplicate accounts through the platform account API', async () => {
    const created = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'gita.officer@h-os.local',
        displayName: 'Gita Officer',
        password: 'Officer-Local-Dev-Only-1',
        locale: 'en',
        roles: ['hr_officer'],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body?.accountId).toBeTypeOf('string');
    state.officerAccountId = created.body?.accountId as string;

    const duplicate = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'gita.officer@h-os.local',
        displayName: 'Gita Officer',
        password: 'Officer-Local-Dev-Only-1',
        locale: 'en',
        roles: [],
      },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({ code: 'conflict' });

    const weakPassword = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'weak@h-os.local',
        displayName: 'Weak',
        password: 'short',
        locale: 'en',
        roles: [],
      },
    });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body).toMatchObject({ code: 'validation_failed' });

    const unknownRole = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'ghost-role@h-os.local',
        displayName: 'Ghost',
        password: 'Ghost-Local-Dev-Only-1',
        locale: 'en',
        roles: ['ghost_role'],
      },
    });
    expect(unknownRole.status).toBe(404);
    expect(unknownRole.body).toMatchObject({ code: 'not_found' });

    const list = await api('/platform/accounts', { cookie: adminCookie });
    expect(list.status).toBe(200);
    const items = list.body?.items as Record<string, unknown>[];
    const officer = items.find((row) => row.email === 'gita.officer@h-os.local');
    expect(officer).toMatchObject({ status: 'active', roles: ['hr_officer'] });
  });

  it('denies account administration to accounts without platform.account.manage', async () => {
    const officerCookie = await login('gita.officer@h-os.local', 'Officer-Local-Dev-Only-1');

    const deniedList = await api('/platform/accounts', { cookie: officerCookie });
    expect(deniedList.status).toBe(403);

    const deniedGrant = await api(`/platform/accounts/${state.selfAccountId}/roles`, {
      method: 'POST',
      cookie: officerCookie,
      body: { roleCode: 'hr_admin' },
    });
    expect(deniedGrant.status).toBe(403);
    expect(deniedGrant.body).toMatchObject({ code: 'forbidden' });

    // And the same officer, holding hr.employee.update, still cannot link a login account:
    // linking is an act of account administration, not an employee update.
    const employeeB = state.employeeB as { id: string };
    const deniedLink = await api(`/employees/${employeeB.id}/account-link`, {
      method: 'POST',
      cookie: officerCookie,
      body: { accountId: state.selfAccountId },
    });
    expect(deniedLink.status).toBe(403);
  });

  it('never lets an administrator modify or disable their own account', async () => {
    const meResult = await api('/auth/me', { cookie: adminCookie });
    const accountId = (meResult.body as { accountId: string }).accountId;

    const selfGrant = await api(`/platform/accounts/${accountId}/roles`, {
      method: 'POST',
      cookie: adminCookie,
      body: { roleCode: 'auditor' },
    });
    expect(selfGrant.status).toBe(403);

    const selfDisable = await api(`/platform/accounts/${accountId}/disable`, {
      method: 'POST',
      cookie: adminCookie,
    });
    expect(selfDisable.status).toBe(403);
  });

  it('assigns and revokes roles, and disabling revokes sessions immediately', async () => {
    const created = await api('/platform/accounts', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        email: 'amal.auditor@h-os.local',
        displayName: 'Amal Auditor',
        password: 'Auditor-Local-Dev-Only-1',
        locale: 'en',
        roles: ['auditor'],
      },
    });
    expect(created.status).toBe(201);
    const accountId = created.body?.accountId as string;

    const granted = await api(`/platform/accounts/${accountId}/roles`, {
      method: 'POST',
      cookie: adminCookie,
      body: { roleCode: 'employee' },
    });
    expect(granted.status).toBe(204);

    const list = await api('/platform/accounts', { cookie: adminCookie });
    const items = list.body?.items as Record<string, unknown>[];
    expect(
      items.find((row) => row.email === 'amal.auditor@h-os.local')?.roles,
    ).toEqual(['auditor', 'employee']);

    const revoked = await api(`/platform/accounts/${accountId}/roles/auditor`, {
      method: 'DELETE',
      cookie: adminCookie,
    });
    expect(revoked.status).toBe(204);

    const listAfter = await api('/platform/accounts', { cookie: adminCookie });
    const itemsAfter = listAfter.body?.items as Record<string, unknown>[];
    expect(itemsAfter.find((row) => row.email === 'amal.auditor@h-os.local')?.roles).toEqual([
      'employee',
    ]);

    // A live session keeps working until disabling; afterwards every session dies instantly.
    const auditorCookie = await login('amal.auditor@h-os.local', 'Auditor-Local-Dev-Only-1');
    await api('/auth/me', { cookie: auditorCookie });

    const disabled = await api(`/platform/accounts/${accountId}/disable`, {
      method: 'POST',
      cookie: adminCookie,
    });
    expect(disabled.status).toBe(204);

    const revokedSession = await api('/auth/me', { cookie: auditorCookie });
    expect(revokedSession.status).toBe(401);

    const disabledLogin = await api('/auth/login', {
      method: 'POST',
      body: { email: 'amal.auditor@h-os.local', password: 'Auditor-Local-Dev-Only-1' },
    });
    expect(disabledLogin.status).toBe(403);
  });

  it('writes platform account administration to the audit trail without credentials', async () => {
    const auditRows = (await handle.db.execute(sql`
      select action, before, after, actor_account_id is not null as has_actor
      from platform.audit_record
      where subject_app = 'platform'
      order by occurred_at
    `)) as unknown as {
      action: string;
      before: unknown;
      after: unknown;
      has_actor: boolean;
    }[];

    const actions = auditRows.map((row) => row.action);
    for (const expected of [
      'platform.account.created',
      'platform.account.role_assigned',
      'platform.account.role_revoked',
      'platform.account.disabled',
    ]) {
      expect(actions, expected).toContain(expected);
    }
    for (const row of auditRows) {
      expect(row.has_actor).toBe(true);
    }

    const serialized = JSON.stringify(auditRows);
    expect(serialized).not.toContain('Officer-Local-Dev-Only-1');
    expect(serialized).not.toContain('Auditor-Local-Dev-Only-1');
    expect(serialized).not.toContain('$argon2id$');
  });
});

function passwordHashMarker(): string {
  return '$argon2id$';
}

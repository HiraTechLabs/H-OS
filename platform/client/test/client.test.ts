import { describe, expect, it } from 'vitest';
import { Permission } from '@h-os/contracts';
import type { SessionUser } from '@h-os/contracts';
import { hasAnyPermission, hasPermission, scopeOf } from '../src/permissions.js';
import { errorMessageKey, ApiError } from '../src/client.js';
import { formatDate, formatNumber, localizedName } from '../src/format.js';

const user: SessionUser = {
  accountId: '00000000-0000-4000-8000-000000000001',
  displayName: 'Test',
  email: 'test@h-os.local',
  locale: 'en',
  roles: ['hr_officer'],
  grants: [
    { permission: Permission.HR_EMPLOYEE_READ, scope: 'subtree' },
    { permission: Permission.HR_ORGANIZATION_MANAGE, scope: 'unit' },
  ],
};

describe('permission helpers', () => {
  it('denies everything without a session', () => {
    expect(hasPermission(null, Permission.HR_EMPLOYEE_READ)).toBe(false);
    expect(scopeOf(null, Permission.HR_EMPLOYEE_READ)).toBeNull();
  });

  it('reports granted permissions and the widest scope', () => {
    expect(hasPermission(user, Permission.HR_EMPLOYEE_READ)).toBe(true);
    expect(hasPermission(user, Permission.HR_EMPLOYEE_CHANGE_STATUS)).toBe(false);
    expect(scopeOf(user, Permission.HR_EMPLOYEE_READ)).toBe('subtree');
    expect(scopeOf(user, Permission.HR_EMPLOYEE_CHANGE_STATUS)).toBeNull();
  });

  it('matches any permission for navigation visibility', () => {
    expect(
      hasAnyPermission(user, [Permission.HR_AUDIT_READ, Permission.HR_EMPLOYEE_READ]),
    ).toBe(true);
    expect(hasAnyPermission(user, [Permission.HR_AUDIT_READ])).toBe(false);
  });
});

describe('error copy mapping', () => {
  it('maps stable problem codes to i18n keys, not server sentences', () => {
    expect(errorMessageKey(new ApiError(409, 'conflict', null, null))).toBe('errors.conflict');
    expect(errorMessageKey(new ApiError(412, 'precondition_failed', null, null))).toBe(
      'errors.precondition',
    );
    expect(errorMessageKey(new ApiError(0, 'network_error', null, null))).toBe('errors.network');
    expect(errorMessageKey(new ApiError(500, 'internal_error', null, null))).toBe('errors.server');
    expect(errorMessageKey(new Error('boom'))).toBe('errors.generic');
  });
});

describe('locale formatting', () => {
  it('picks the requested language of a localized value', () => {
    const value = { en: 'Payroll', ar: 'الرواتب' };
    expect(localizedName(value, 'en')).toBe('Payroll');
    expect(localizedName(value, 'ar')).toBe('الرواتب');
    expect(localizedName(null, 'ar')).toBe('');
  });

  it('formats business dates as calendar dates without time-zone drift', () => {
    expect(formatDate('2025-07-01', 'en')).toContain('2025');
    expect(formatDate('2025-07-01', 'ar')).not.toBe('2025-07-01');
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1234, 'en')).toMatch(/1[,.]?234/);
    expect(formatNumber(1234, 'ar')).not.toBe('1234');
  });
});

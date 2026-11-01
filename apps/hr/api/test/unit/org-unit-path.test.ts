import { describe, expect, it } from 'vitest';
import {
  childPath,
  isDescendantPath,
  isOrgUnitCode,
  labelFor,
} from '../../src/domain/org-unit-path.js';

describe('organization unit paths', () => {
  it('derives ltree-safe labels from user-facing codes', () => {
    expect(labelFor('OPS')).toBe('ops');
    expect(labelFor('OPS-PAY')).toBe('ops_pay');
    expect(isOrgUnitCode('OPS-PAY')).toBe(true);
    expect(isOrgUnitCode('O')).toBe(false);
    expect(isOrgUnitCode('ops')).toBe(false);
    expect(isOrgUnitCode('OPS PAY')).toBe(false);
    expect(isOrgUnitCode('OPS.PAY')).toBe(false);
    expect(isOrgUnitCode('A'.repeat(33))).toBe(false);
  });

  it('refuses to build a path from an invalid code', () => {
    expect(() => childPath(null, 'bad code')).toThrowError(/not valid/i);
  });

  it('builds root and child paths from the parent path', () => {
    expect(childPath(null, 'HQ')).toBe('hq');
    expect(childPath('hq', 'OPS')).toBe('hq.ops');
    expect(childPath('hq.ops', 'OPS-PAY')).toBe('hq.ops.ops_pay');
  });

  it('treats a path as its own descendant but not a prefix sibling', () => {
    expect(isDescendantPath('hq.ops', 'hq.ops')).toBe(true);
    expect(isDescendantPath('hq.ops.pay', 'hq.ops')).toBe(true);
    expect(isDescendantPath('hq.ops2', 'hq.ops')).toBe(false);
    expect(isDescendantPath('hq', 'hq.ops')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { formatEmployeeNumber, isEmployeeNumber } from '../../src/domain/employee-number.js';

describe('employee numbers', () => {
  it('formats the organization sequence with a stable prefix and width', () => {
    expect(formatEmployeeNumber(1)).toBe('EMP-00001');
    expect(formatEmployeeNumber(42)).toBe('EMP-00042');
    expect(formatEmployeeNumber(99999)).toBe('EMP-99999');
    expect(formatEmployeeNumber(100000)).toBe('EMP-100000');
  });

  it('rejects a non-positive or non-integer sequence value', () => {
    expect(() => formatEmployeeNumber(0)).toThrow(RangeError);
    expect(() => formatEmployeeNumber(-1)).toThrow(RangeError);
    expect(() => formatEmployeeNumber(1.5)).toThrow(RangeError);
    expect(() => formatEmployeeNumber(Number.NaN)).toThrow(RangeError);
  });

  it('validates externally supplied numbers', () => {
    expect(isEmployeeNumber('EMP-00001')).toBe(true);
    expect(isEmployeeNumber('HR-2025-0001')).toBe(true);
    expect(isEmployeeNumber('emp-00001')).toBe(false);
    expect(isEmployeeNumber('-EMP')).toBe(false);
    expect(isEmployeeNumber('A'.repeat(25))).toBe(false);
  });
});

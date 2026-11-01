import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareBusinessDates,
  isBefore,
  isBusinessDate,
  isOnOrBefore,
  isValidRange,
  rangeContains,
  rangesOverlap,
} from '../../src/domain/business-date.js';

/**
 * Business dates are calendar values, not instants (BIZ-010). The tests deliberately avoid local
 * time-zone behaviour so a machine in Riyadh and a CI runner in UTC agree.
 */
describe('business dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isBusinessDate('2024-02-29')).toBe(true);
    expect(isBusinessDate('2025-01-01')).toBe(true);
    expect(isBusinessDate('2023-02-29')).toBe(false);
    expect(isBusinessDate('2025-02-30')).toBe(false);
    expect(isBusinessDate('2025-13-01')).toBe(false);
    expect(isBusinessDate('2025-1-1')).toBe(false);
    expect(isBusinessDate('01/01/2025')).toBe(false);
    expect(isBusinessDate('')).toBe(false);
  });

  it('compares dates without time-zone drift', () => {
    expect(compareBusinessDates('2025-01-01', '2025-01-02')).toBe(-1);
    expect(compareBusinessDates('2025-01-02', '2025-01-01')).toBe(1);
    expect(compareBusinessDates('2025-01-01', '2025-01-01')).toBe(0);
    expect(isBefore('2024-12-31', '2025-01-01')).toBe(true);
    expect(isOnOrBefore('2025-01-01', '2025-01-01')).toBe(true);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
  });

  it('treats effective ranges as half-open', () => {
    const first = { from: '2025-01-01', to: '2025-02-01' };
    const second = { from: '2025-02-01', to: null };
    // The end date is exclusive: a new assignment may start the day the old one ends.
    expect(rangesOverlap(first, second)).toBe(false);
    expect(rangesOverlap(first, { from: '2025-01-31', to: null })).toBe(true);
    expect(rangesOverlap({ from: '2025-01-01', to: null }, { from: '2030-01-01', to: null })).toBe(
      true,
    );
    expect(rangeContains(first, '2025-01-01')).toBe(true);
    expect(rangeContains(first, '2025-02-01')).toBe(false);
    expect(rangeContains(second, '2099-12-31')).toBe(true);
  });

  it('validates ranges including open-ended ones', () => {
    expect(isValidRange({ from: '2025-01-01', to: null })).toBe(true);
    expect(isValidRange({ from: '2025-01-01', to: '2025-01-02' })).toBe(true);
    expect(isValidRange({ from: '2025-01-02', to: '2025-01-01' })).toBe(false);
    expect(isValidRange({ from: '2025-01-01', to: '2025-01-01' })).toBe(false);
    expect(isValidRange({ from: 'not-a-date', to: null })).toBe(false);
    expect(isValidRange({ from: '2025-01-01', to: '2025-02-30' })).toBe(false);
  });
});

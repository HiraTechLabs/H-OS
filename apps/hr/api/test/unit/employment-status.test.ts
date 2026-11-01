import { describe, expect, it } from 'vitest';
import {
  EMPLOYMENT_STATUSES,
  allowedTransitions,
  canTransition,
  isEmploymentStatus,
  isEndStatus,
  isOpenStatus,
} from '../../src/domain/employment-status.js';

/**
 * The lifecycle is the core HR rule (HR-DEC-0001). These tests pin the exact transition matrix so
 * a future change cannot silently widen it.
 */
const EXPECTED: Readonly<Record<string, readonly string[]>> = {
  pending_start: ['active', 'cancelled'],
  active: ['probation', 'suspended', 'notice_period', 'terminated'],
  probation: ['active', 'notice_period', 'terminated'],
  suspended: ['active', 'notice_period', 'terminated'],
  notice_period: ['active', 'terminated'],
  terminated: ['pending_start'],
  retired: ['pending_start'],
  cancelled: ['pending_start'],
};

describe('employment status machine', () => {
  it('defines exactly the eight approved statuses', () => {
    expect([...EMPLOYMENT_STATUSES].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('matches the approved transition matrix in both directions', () => {
    for (const from of EMPLOYMENT_STATUSES) {
      for (const to of EMPLOYMENT_STATUSES) {
        const expected = EXPECTED[from]?.includes(to) ?? false;
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
      expect([...allowedTransitions(from)].sort()).toEqual([...(EXPECTED[from] ?? [])].sort());
    }
  });

  it('never allows a transition to the same status', () => {
    for (const status of EMPLOYMENT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('treats terminated, retired and cancelled as end statuses', () => {
    for (const status of EMPLOYMENT_STATUSES) {
      const expected = status === 'terminated' || status === 'retired' || status === 'cancelled';
      expect(isEndStatus(status), status).toBe(expected);
      expect(isOpenStatus(status), status).toBe(!expected);
    }
  });

  it('only lets terminal statuses re-enter through pending_start', () => {
    for (const status of ['terminated', 'retired', 'cancelled'] as const) {
      expect(allowedTransitions(status)).toEqual(['pending_start']);
    }
  });

  it('recognises only known status values', () => {
    expect(isEmploymentStatus('active')).toBe(true);
    expect(isEmploymentStatus('inactive')).toBe(false);
    expect(isEmploymentStatus('ACTIVE')).toBe(false);
  });
});

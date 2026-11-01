/**
 * Employee numbers are business-facing and immutable (HHR-DOM-001). They come from a per
 * organization server-side sequence allocated inside the transaction (BIZ-008).
 */
export const EMPLOYEE_NUMBER_PREFIX = 'EMP';
const SEQUENCE_WIDTH = 5;

export function formatEmployeeNumber(sequenceValue: number): string {
  if (!Number.isInteger(sequenceValue) || sequenceValue < 1) {
    throw new RangeError('Employee number sequence must be a positive integer.');
  }
  return `${EMPLOYEE_NUMBER_PREFIX}-${String(sequenceValue).padStart(SEQUENCE_WIDTH, '0')}`;
}

export function isEmployeeNumber(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{0,23}$/.test(value);
}

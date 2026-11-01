/**
 * Business dates are date-only values (`YYYY-MM-DD`), never instants (BIZ-010). All comparisons
 * use UTC parsing so device or server time zones cannot shift a calendar day.
 */
const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isBusinessDate(value: string): boolean {
  const match = BUSINESS_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function toUtc(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function compareBusinessDates(left: string, right: string): number {
  return Math.sign(toUtc(left) - toUtc(right));
}

export function isBefore(left: string, right: string): boolean {
  return compareBusinessDates(left, right) < 0;
}

export function isOnOrBefore(left: string, right: string): boolean {
  return compareBusinessDates(left, right) <= 0;
}

export function addDays(value: string, days: number): string {
  const date = new Date(toUtc(value) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}

/** Exclusive end: the range covers `from` up to, but not including, `to`. */
export interface BusinessDateRange {
  readonly from: string;
  readonly to: string | null;
}

export function isValidRange(range: BusinessDateRange): boolean {
  if (!isBusinessDate(range.from)) return false;
  if (range.to === null) return true;
  if (!isBusinessDate(range.to)) return false;
  return isBefore(range.from, range.to);
}

/** Half-open overlap test; `null` ends are unbounded. */
export function rangesOverlap(left: BusinessDateRange, right: BusinessDateRange): boolean {
  const leftEnd = left.to === null ? Number.POSITIVE_INFINITY : toUtc(left.to);
  const rightEnd = right.to === null ? Number.POSITIVE_INFINITY : toUtc(right.to);
  return toUtc(left.from) < rightEnd && toUtc(right.from) < leftEnd;
}

/** True when the range contains the given business date. */
export function rangeContains(range: BusinessDateRange, date: string): boolean {
  if (isBefore(date, range.from)) return false;
  if (range.to === null) return true;
  return isBefore(date, range.to);
}

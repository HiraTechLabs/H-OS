/**
 * Employment lifecycle state machine (HR-DEC-0001). The domain owns the transitions; the API,
 * the database and the UI never decide them.
 */
export const EMPLOYMENT_STATUSES = [
  'pending_start',
  'active',
  'probation',
  'suspended',
  'notice_period',
  'terminated',
  'retired',
  'cancelled',
] as const;

export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/**
 * `terminated` and `retired` are terminal for the episode; a rehire starts a new episode and the
 * employee re-enters through `pending_start`.
 */
const TRANSITIONS: Readonly<Record<EmploymentStatus, readonly EmploymentStatus[]>> = {
  pending_start: ['active', 'cancelled'],
  active: ['probation', 'suspended', 'notice_period', 'terminated'],
  probation: ['active', 'notice_period', 'terminated'],
  suspended: ['active', 'notice_period', 'terminated'],
  notice_period: ['active', 'terminated'],
  terminated: ['pending_start'],
  retired: ['pending_start'],
  cancelled: ['pending_start'],
};

const OPEN_STATUSES: readonly EmploymentStatus[] = [
  'pending_start',
  'active',
  'probation',
  'suspended',
  'notice_period',
];

export function canTransition(from: EmploymentStatus, to: EmploymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: EmploymentStatus): readonly EmploymentStatus[] {
  return TRANSITIONS[from];
}

/** Statuses in which the employment episode is still running. */
export function isOpenStatus(status: EmploymentStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/**
 * Bilingual labels for audit and timeline summaries. Status codes are storage values, never
 * user-facing copy, so summaries translate them through this map (HHR-UX-007).
 */
const STATUS_LABELS: Readonly<Record<EmploymentStatus, { readonly en: string; readonly ar: string }>> =
  {
    pending_start: { en: 'pending start', ar: 'بانتظار المباشرة' },
    active: { en: 'active', ar: 'نشط' },
    probation: { en: 'probation', ar: 'فترة تجربة' },
    suspended: { en: 'suspended', ar: 'موقوف' },
    notice_period: { en: 'notice period', ar: 'فترة إشعار' },
    terminated: { en: 'terminated', ar: 'منتهي' },
    retired: { en: 'retired', ar: 'متقاعد' },
    cancelled: { en: 'cancelled', ar: 'ملغى' },
  };

export function employmentStatusLabel(
  status: EmploymentStatus,
): { readonly en: string; readonly ar: string } {
  return STATUS_LABELS[status];
}

/** Statuses that end an employment episode. */
export function isEndStatus(status: EmploymentStatus): boolean {
  return status === 'terminated' || status === 'retired' || status === 'cancelled';
}

export function isEmploymentStatus(value: string): value is EmploymentStatus {
  return (EMPLOYMENT_STATUSES as readonly string[]).includes(value);
}

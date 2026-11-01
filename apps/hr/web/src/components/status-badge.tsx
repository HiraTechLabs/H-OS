import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@h-os/ui';
import type { BadgeTone } from '@h-os/ui';
import type { EmploymentStatus, WorkArrangement } from '@h-os/contracts';

const STATUS_TONE: Readonly<Record<EmploymentStatus, BadgeTone>> = {
  pending_start: 'accent',
  active: 'success',
  probation: 'info',
  suspended: 'warning',
  notice_period: 'warning',
  terminated: 'danger',
  retired: 'neutral',
  cancelled: 'neutral',
};

/** Status is always rendered as text plus a tone, never colour alone (UX-014). */
export function StatusBadge({ status }: { readonly status: EmploymentStatus }): ReactNode {
  const { t } = useTranslation();
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>;
}

export function EmploymentTypeBadge({
  type,
}: {
  readonly type: string;
}): ReactNode {
  const { t } = useTranslation();
  return <Badge tone="neutral">{t(`employmentType.${type}`, { defaultValue: type })}</Badge>;
}

export function WorkArrangementLabel({
  arrangement,
}: {
  readonly arrangement: WorkArrangement;
}): ReactNode {
  const { t } = useTranslation();
  return <>{t(`workArrangement.${arrangement}`)}</>;
}

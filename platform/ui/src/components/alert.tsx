import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps {
  readonly tone?: AlertTone;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * Inline feedback. Errors are announced assertively; every other tone is polite. A title is
 * optional because some messages are one short sentence.
 */
export function Alert({ tone = 'info', title, children, className }: AlertProps): ReactNode {
  return (
    <div
      className={cn('hos-alert', `hos-alert-${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : undefined}>{children}</div> : null}
    </div>
  );
}

import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  readonly tone?: BadgeTone;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Status chips pair a tone with text, so meaning never depends on colour alone (UX-014). */
export function Badge({ tone = 'neutral', children, className }: BadgeProps): ReactNode {
  return <span className={cn('hos-badge', `hos-badge-${tone}`, className)}>{children}</span>;
}

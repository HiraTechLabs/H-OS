import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface PageHeaderProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}

/** Consistent page heading across every app (UX-001, UX-011). */
export function PageHeader({ title, description, actions }: PageHeaderProps): ReactNode {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink-strong sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export interface EmptyStateProps {
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly action?: ReactNode;
}

/** Every list and detail screen defines an empty state, never a blank panel (UX-008). */
export function EmptyState({ title, description, action }: EmptyStateProps): ReactNode {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-strong">{title}</p>
      {description ? <p className="max-w-prose text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({
  className,
  ...rest
}: {
  readonly className?: string;
  readonly 'aria-hidden'?: boolean;
}): ReactNode {
  return <div className={cn('hos-skeleton h-4', className)} aria-hidden="true" {...rest} />;
}

export function Spinner({ label }: { readonly label: string }): ReactNode {
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted" role="status">
      <span
        aria-hidden="true"
        className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-accent-strong"
      />
      <span>{label}</span>
    </div>
  );
}

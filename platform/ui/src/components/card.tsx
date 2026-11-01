import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface CardProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}

/** A bordered surface with an optional heading and actions row. */
export function Card({
  title,
  description,
  actions,
  className,
  children,
  ...rest
}: CardProps): ReactNode {
  return (
    <section className={cn('hos-card', className)} {...rest}>
      {title || description || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="min-w-0">
            {title ? <h2 className="hos-card-title">{title}</h2> : null}
            {description ? <p className="hos-card-subtitle mt-0.5">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="hos-card-body">{children}</div>
    </section>
  );
}

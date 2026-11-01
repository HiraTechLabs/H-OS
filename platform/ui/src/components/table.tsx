import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

/** Horizontal scroll on narrow screens is deliberate and contained (UX-016). */
export function Table({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'table'>): ReactNode {
  return (
    <div className="hos-table-wrap">
      <table className={cn('hos-table', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

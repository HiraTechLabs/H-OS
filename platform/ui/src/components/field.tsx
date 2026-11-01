import { useId } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string | null;
  readonly required?: boolean;
  readonly children: (props: {
    readonly id: string;
    readonly 'aria-invalid': boolean;
    readonly 'aria-describedby': string | undefined;
  }) => ReactNode;
}

/**
 * Label, hint and error wiring in one place so no control ships unlabeled and every error is
 * announced (UX-007, UX-009). The render prop keeps native inputs in charge of their own type.
 */
export function Field({ label, hint, error, required = false, children }: FieldProps): ReactNode {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="hos-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint ? (
        <p className="hos-help" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="hos-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithoutRef<'input'>): ReactNode {
  return <input className={cn('hos-input', className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentPropsWithoutRef<'select'>): ReactNode {
  return <select className={cn('hos-select', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>): ReactNode {
  return <textarea className={cn('hos-textarea', className)} {...rest} />;
}

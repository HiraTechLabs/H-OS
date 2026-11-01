import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm';
}

/**
 * The single button primitive. It renders a real `<button>` with a visible focus ring and a
 * disabled state; icon-only buttons must still receive an accessible name (UX-007).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: ButtonProps): ReactNode {
  return (
    <button
      type={type}
      className={cn(
        'hos-button',
        `hos-button-${variant}`,
        size === 'sm' && 'hos-button-sm',
        className,
      )}
      {...rest}
    />
  );
}

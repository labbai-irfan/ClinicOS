import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full min-h-[44px] rounded border bg-surface px-3 text-sm text-text-primary placeholder:text-text-secondary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[88px] w-full rounded border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      invalid ? 'border-danger' : 'border-border',
      className,
    )}
    aria-invalid={invalid || undefined}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

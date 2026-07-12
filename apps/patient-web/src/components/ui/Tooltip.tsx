import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className={cn(
            'z-50 rounded bg-text-primary px-2.5 py-1.5 text-xs text-background shadow-popover',
          )}
          sideOffset={6}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-text-primary" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Icon-only button MUST use this so it always has an accessible name + visible tooltip (spec §32). */
export function IconButton({
  label,
  icon: Icon,
  className,
  ...props
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Tooltip label={label}>
      <button
        aria-label={label}
        className={cn(
          'inline-flex h-11 w-11 min-h-[44px] items-center justify-center rounded text-text-secondary hover:bg-surface-muted hover:text-text-primary',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          className,
        )}
        {...props}
      >
        <Icon className="h-5 w-5" />
      </button>
    </Tooltip>
  );
}

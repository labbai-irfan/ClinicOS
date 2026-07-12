import * as React from 'react';
import { AlertTriangle, CheckCircle2, Circle, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-text-secondary border-border',
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
};

const toneIcons: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

/**
 * Status indicator that never relies on color alone (spec §21, §32) — always
 * pairs an icon with the text label.
 */
export function StatusPill({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { StatusPill, type StatusTone } from '../../../components/ui/StatusPill';
import { cn } from '../../../lib/utils';

export function KpiCard({
  icon: Icon,
  label,
  value,
  caption,
  tone,
  toneLabel,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  caption?: string;
  tone?: StatusTone;
  toneLabel?: string;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0 p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {tone && toneLabel && <StatusPill tone={tone} label={toneLabel} className="shrink-0" />}
      </div>
      <p className="mt-3 truncate text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{label}</p>
      {caption && <p className="mt-1 text-xs text-text-secondary">{caption}</p>}
    </Card>
  );
}

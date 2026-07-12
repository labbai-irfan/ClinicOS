import { Label } from '../../../components/ui/Field';
import { cn } from '../../../lib/utils';
import { painLevelLabel } from '../utils';

const LEVELS = Array.from({ length: 11 }, (_, n) => n);

/**
 * Pain level as a labeled 0-10 number scale (spec §21/§32: never color-only). The
 * selected level is conveyed by a filled/outlined state AND the number itself, and the
 * band label ("Mild"/"Severe"/...) is always shown as text underneath.
 */
export function PainScale({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="pain-scale-0">Pain level</Label>
      <div role="radiogroup" aria-label="Pain level, 0 (no pain) to 10 (worst possible)" className="flex flex-wrap gap-2">
        {LEVELS.map((level) => {
          const selected = value === level;
          return (
            <button
              key={level}
              id={level === 0 ? 'pain-scale-0' : undefined}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? undefined : level)}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded border text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface text-text-primary hover:bg-surface-muted',
              )}
            >
              {level}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-text-secondary">
        {value !== undefined ? `${value}/10 — ${painLevelLabel(value)}` : 'Not recorded'}
      </p>
    </div>
  );
}

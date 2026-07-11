import { useId } from 'react';
import { format, subDays } from 'date-fns';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import type { AnalyticsDateRange } from '../api';

const PRESETS: { label: string; days: number }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

/** Inclusive range ending today, e.g. `days=30` -> today and the 29 days before it. */
export function rangeForLastDays(days: number, now: Date = new Date()): AnalyticsDateRange {
  return {
    startDate: format(subDays(now, days - 1), 'yyyy-MM-dd'),
    endDate: format(now, 'yyyy-MM-dd'),
  };
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: AnalyticsDateRange;
  onChange: (range: AnalyticsDateRange) => void;
}) {
  const startId = useId();
  const endId = useId();
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="From" htmlFor={startId}>
          <Input
            id={startId}
            type="date"
            value={value.startDate}
            max={value.endDate}
            onChange={(e) => {
              if (e.target.value) onChange({ ...value, startDate: e.target.value });
            }}
          />
        </Field>
        <Field label="To" htmlFor={endId}>
          <Input
            id={endId}
            type="date"
            value={value.endDate}
            min={value.startDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) onChange({ ...value, endDate: e.target.value });
            }}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date range presets">
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(rangeForLastDays(preset.days))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}

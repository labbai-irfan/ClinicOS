import { useId } from 'react';
import type { VitalRecordDto } from '@clinicos/types';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Field';
import { bmiCategory, computeClientBmi, formatDateTime, type VitalsValues } from '../utils';

interface VitalRow {
  key: keyof VitalsValues;
  label: string;
  unit: string;
  step?: string;
  inputMode: 'numeric' | 'decimal';
}

const ROWS: VitalRow[] = [
  { key: 'temperatureC', label: 'Temperature', unit: '°C', step: '0.1', inputMode: 'decimal' },
  { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', inputMode: 'numeric' },
  { key: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', inputMode: 'numeric' },
  { key: 'pulseBpm', label: 'Pulse', unit: 'bpm', inputMode: 'numeric' },
  { key: 'spo2Percent', label: 'SpO2', unit: '%', step: '0.1', inputMode: 'decimal' },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: 'breaths/min', inputMode: 'numeric' },
  { key: 'heightCm', label: 'Height', unit: 'cm', step: '0.1', inputMode: 'decimal' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', step: '0.1', inputMode: 'decimal' },
  { key: 'bloodGlucoseMgDl', label: 'Blood glucose', unit: 'mg/dL', inputMode: 'numeric' },
];

function VitalInput({
  row,
  value,
  onChange,
  disabled,
}: {
  row: VitalRow;
  value?: number;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {row.label} <span className="font-normal text-text-secondary">({row.unit})</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode={row.inputMode}
        step={row.step}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }}
      />
    </div>
  );
}

/** Editable vitals capture — number inputs with explicit units and a live BMI preview. */
export function VitalsFields({
  values,
  onChange,
  disabled,
}: {
  values: VitalsValues;
  onChange: (values: VitalsValues) => void;
  disabled?: boolean;
}) {
  const bmi = computeClientBmi(values.heightCm, values.weightKg);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ROWS.map((row) => (
          <VitalInput
            key={row.key}
            row={row}
            value={values[row.key]}
            disabled={disabled}
            onChange={(value) => onChange({ ...values, [row.key]: value })}
          />
        ))}
      </div>
      {bmi !== undefined && (
        <p className="rounded border border-border bg-surface-muted px-3 py-2 text-sm text-text-primary">
          BMI preview: <span className="font-semibold">{bmi}</span>{' '}
          <span className="text-text-secondary">({bmiCategory(bmi)})</span>
        </p>
      )}
    </div>
  );
}

/** Read-only display of a saved vitals reading — used once a visit's vitals are already recorded. */
export function VitalsReadonly({ vitals }: { vitals: VitalRecordDto }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ROWS.map((row) => {
          const value = vitals[row.key];
          return (
            <div key={row.key} className="space-y-0.5">
              <p className="text-xs text-text-secondary">
                {row.label} ({row.unit})
              </p>
              <p className="text-sm font-medium text-text-primary">{value ?? '—'}</p>
            </div>
          );
        })}
      </div>
      {vitals.bmi !== undefined && (
        <p className="rounded border border-border bg-surface-muted px-3 py-2 text-sm text-text-primary">
          BMI: <span className="font-semibold">{vitals.bmi}</span>{' '}
          <span className="text-text-secondary">({bmiCategory(vitals.bmi)})</span>
        </p>
      )}
      <p className="text-xs text-text-secondary">
        Recorded {formatDateTime(vitals.recordedAt)}
        {vitals.recordedByName ? ` by ${vitals.recordedByName}` : ''}
      </p>
    </div>
  );
}

import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Field';
import { IconButton } from '../../../components/ui/Tooltip';

interface ChipListProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  maxItems?: number;
  maxLength?: number;
  error?: string;
  tone?: 'neutral' | 'danger';
}

/**
 * Chip-style editor for short repeatable strings (symptoms, allergies, conditions,
 * medicines, tests, diagnosis...). Enter (or the Add button) commits the draft input as
 * a new chip; each chip has its own labelled remove control (spec §32: no icon-only
 * controls without an accessible name).
 */
export function ChipList({
  label,
  values,
  onChange,
  placeholder = 'Type and press Enter',
  emptyHint = 'None added yet',
  disabled = false,
  maxItems = 50,
  maxLength = 160,
  error,
  tone = 'neutral',
}: ChipListProps) {
  const [draft, setDraft] = useState('');
  const inputId = useId();

  function commit() {
    const value = draft.trim();
    if (!value || disabled || values.length >= maxItems) {
      setDraft('');
      return;
    }
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, value.slice(0, maxLength)]);
    setDraft('');
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  const chipClasses =
    tone === 'danger'
      ? 'border-danger/30 bg-danger/10 text-danger'
      : 'border-border bg-surface-muted text-text-primary';

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {values.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyHint}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, index) => (
            <li
              key={`${value}-${index}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${chipClasses}`}
            >
              <span>{value}</span>
              {!disabled && (
                <IconButton
                  label={`Remove ${value}`}
                  icon={X}
                  className="h-5 w-5 min-h-0 p-0 text-current hover:bg-transparent hover:opacity-70"
                  onClick={() => removeAt(index)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={draft}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-label={`Add to ${label}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={commit} aria-label={`Add to ${label}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

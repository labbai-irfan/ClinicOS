import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { PatientDto } from '@clinicos/types';
import { IconButton, Input } from '../../../components/ui';
import { usePatientSearchQuery } from '../api';

export interface PickedPatient {
  id: string;
  label: string;
}

interface PatientPickerProps {
  value: PickedPatient | null;
  onChange: (patient: PickedPatient | null) => void;
  invalid?: boolean;
}

/** Debounce-free (query only fires at 2+ chars) typeahead over GET /patients. */
export function PatientPicker({ value, onChange, invalid }: PatientPickerProps) {
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = usePatientSearchQuery(query);

  if (value) {
    return (
      <div className="flex min-h-[44px] items-center justify-between rounded border border-border bg-surface-muted px-3">
        <span className="text-sm font-medium text-text-primary">{value.label}</span>
        <IconButton label="Change patient" icon={X} onClick={() => onChange(null)} />
      </div>
    );
  }

  const showResults = query.trim().length >= 2;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, mobile, or patient code"
          className="pl-9"
          invalid={invalid}
          aria-label="Search patient"
          autoComplete="off"
        />
      </div>
      {showResults && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-border bg-surface shadow-popover">
          {isFetching && <p className="p-3 text-sm text-text-secondary">Searching…</p>}
          {!isFetching && results?.length === 0 && (
            <p className="p-3 text-sm text-text-secondary">No patients found.</p>
          )}
          {results?.map((patient: PatientDto) => (
            <button
              key={patient.id}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-muted"
              onClick={() => {
                onChange({ id: patient.id, label: `${patient.fullName} (${patient.code})` });
                setQuery('');
              }}
            >
              <span className="font-medium text-text-primary">{patient.fullName}</span>
              <span className="text-xs text-text-secondary">
                {patient.code}
                {patient.mobile ? ` · ${patient.mobile}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusPill,
} from '../../../components/ui';
import { useAvailableSlotsQuery, useDoctorsQuery } from '../api';
import { formatTimeLabel } from '../lib/time';

export interface AvailabilitySlotSelection {
  doctorId: string;
  date: string;
  windowStart: string;
  windowEnd: string;
}

interface DoctorAvailabilityViewProps {
  onSelectSlot: (selection: AvailabilitySlotSelection) => void;
}

/** Per-doctor slot grid for a chosen date, backed by GET /schedules/available-slots. */
export function DoctorAvailabilityView({ onSelectSlot }: DoctorAvailabilityViewProps) {
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const doctorsQuery = useDoctorsQuery();
  const slotsQuery = useAvailableSlotsQuery({ doctorId, date });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Doctor" htmlFor="availability-doctor" required>
          {doctorsQuery.isError ? (
            <Input
              id="availability-doctor"
              placeholder="Enter doctor staff ID"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
            />
          ) : (
            <Select value={doctorId || undefined} onValueChange={setDoctorId}>
              <SelectTrigger id="availability-doctor" className="min-w-[220px]">
                <SelectValue placeholder={doctorsQuery.isLoading ? 'Loading…' : 'Select a doctor'} />
              </SelectTrigger>
              <SelectContent>
                {doctorsQuery.data?.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.userId}>
                    Dr. {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <Field label="Date" htmlFor="availability-date" required>
          <Input id="availability-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {!doctorId && <p className="text-sm text-text-secondary">Choose a doctor to see their slot grid.</p>}
      {doctorId && slotsQuery.isLoading && <p className="text-sm text-text-secondary">Loading availability…</p>}
      {doctorId && slotsQuery.isError && (
        <p className="text-sm text-text-secondary">Could not load availability for this date.</p>
      )}

      {doctorId && slotsQuery.data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {slotsQuery.data.length === 0 && (
            <p className="col-span-full text-sm text-text-secondary">
              No sessions scheduled for this doctor on this date.
            </p>
          )}
          {slotsQuery.data.map((slot) => (
            <button
              key={`${slot.windowStart}-${slot.windowEnd}`}
              type="button"
              disabled={!slot.available}
              onClick={() => onSelectSlot({ doctorId, date, windowStart: slot.windowStart, windowEnd: slot.windowEnd })}
              className="flex flex-col items-center gap-1 rounded border border-border p-2 text-xs disabled:cursor-not-allowed disabled:opacity-60 enabled:hover:border-primary"
            >
              <span className="font-medium text-text-primary">
                {formatTimeLabel(slot.windowStart)}–{formatTimeLabel(slot.windowEnd)}
              </span>
              <StatusPill label={slot.available ? 'Open' : 'Full'} tone={slot.available ? 'success' : 'danger'} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

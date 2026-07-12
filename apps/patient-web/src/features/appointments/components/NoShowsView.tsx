import { useState } from 'react';
import { format, subDays } from 'date-fns';
import type { AppointmentDto } from '@clinicos/types';
import { Card, CardContent, Field, Input, StatusPill } from '../../../components/ui';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useAppointmentsQuery } from '../api';
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, APPOINTMENT_TYPE_LABEL } from '../status';
import { formatTimeLabel } from '../lib/time';

interface NoShowsViewProps {
  onSelectAppointment: (appointment: AppointmentDto) => void;
}

/** Appointments filtered to the `no_show` status, over a date range picker (default: 30 days). */
export function NoShowsView({ onSelectAppointment }: NoShowsViewProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [from, setFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(today);

  const query = useAppointmentsQuery({ from, to, status: 'no_show' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="From" htmlFor="no-show-from">
          <Input id="no-show-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To" htmlFor="no-show-to">
          <Input id="no-show-to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <QueryBoundary
        isLoading={query.isLoading}
        isError={query.isError}
        data={query.data}
        onRetry={() => void query.refetch()}
        isEmpty={(data) => data.length === 0}
        emptyTitle="No no-shows in this range"
        emptyDescription="Appointments marked no-show will appear here."
      >
        {(appointments) => (
          <div className="space-y-2">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <button type="button" className="text-left" onClick={() => onSelectAppointment(appointment)}>
                    <p className="font-medium text-text-primary">{appointment.patient?.fullName ?? 'Patient'}</p>
                    <p className="text-xs text-text-secondary">
                      {appointment.date} · {formatTimeLabel(appointment.windowStart)}–
                      {formatTimeLabel(appointment.windowEnd)} · Dr. {appointment.doctorName ?? '—'} ·{' '}
                      {APPOINTMENT_TYPE_LABEL[appointment.type]}
                    </p>
                  </button>
                  <StatusPill
                    label={APPOINTMENT_STATUS_LABEL[appointment.status]}
                    tone={APPOINTMENT_STATUS_TONE[appointment.status]}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

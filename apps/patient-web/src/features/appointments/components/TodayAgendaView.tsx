import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { AppointmentDto } from '@clinicos/types';
import { Card, CardContent, CardHeader, CardTitle, StatusPill } from '../../../components/ui';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useAppointmentsQuery } from '../api';
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUS_TONE, APPOINTMENT_TYPE_LABEL } from '../status';
import { formatTimeLabel, recommendedArrivalLabel } from '../lib/time';
import { StatusActionBar } from './StatusActionBar';

interface TodayAgendaViewProps {
  date: string;
  onSelectAppointment: (appointment: AppointmentDto) => void;
}

/** Today's appointments grouped by doctor, sorted by window start, with quick status actions. */
export function TodayAgendaView({ date, onSelectAppointment }: TodayAgendaViewProps) {
  const query = useAppointmentsQuery({ date });

  const groups = useMemo(() => {
    const items = query.data ?? [];
    const byDoctor = new Map<string, AppointmentDto[]>();
    for (const appointment of items) {
      const key = appointment.doctorName ?? appointment.doctorId;
      byDoctor.set(key, [...(byDoctor.get(key) ?? []), appointment]);
    }
    return [...byDoctor.entries()]
      .map(([doctor, appts]) => [doctor, [...appts].sort((a, b) => a.windowStart.localeCompare(b.windowStart))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [query.data]);

  return (
    <QueryBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      data={query.data}
      onRetry={() => void query.refetch()}
      isEmpty={(data) => data.length === 0}
      emptyTitle="No appointments today"
      emptyDescription={`Nothing scheduled for ${format(parseISO(date), 'PP')} yet.`}
    >
      {() => (
        <div className="space-y-4">
          {groups.map(([doctor, appts]) => (
            <Card key={doctor}>
              <CardHeader>
                <CardTitle>Dr. {doctor}</CardTitle>
                <span className="text-sm text-text-secondary">
                  {appts.length} appointment{appts.length === 1 ? '' : 's'}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {appts.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col gap-2 rounded border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <button type="button" className="text-left" onClick={() => onSelectAppointment(appointment)}>
                      <p className="font-medium text-text-primary">
                        {formatTimeLabel(appointment.windowStart)}–{formatTimeLabel(appointment.windowEnd)} ·{' '}
                        {appointment.patient?.fullName ?? 'Patient'}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {APPOINTMENT_TYPE_LABEL[appointment.type]} · Arrive by {recommendedArrivalLabel(appointment)}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill
                        label={APPOINTMENT_STATUS_LABEL[appointment.status]}
                        tone={APPOINTMENT_STATUS_TONE[appointment.status]}
                      />
                      <StatusActionBar appointment={appointment} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </QueryBoundary>
  );
}

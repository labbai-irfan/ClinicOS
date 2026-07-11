import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type DateClickArg } from '@fullcalendar/interaction';
import type { DateSelectArg, DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core';
import { addMinutes, format } from 'date-fns';
import type { AppointmentDto } from '@clinicos/types';
import { APPOINTMENT_STATUS_LABEL, appointmentStatusColor, appointmentStatusTint } from '../status';

export interface CalendarRangeChange {
  from: string;
  to: string;
}

export interface CalendarSlotSelection {
  date: string;
  windowStart: string;
  windowEnd: string;
}

interface CalendarViewProps {
  appointments: AppointmentDto[];
  canCreate: boolean;
  onRangeChange: (range: CalendarRangeChange) => void;
  onSelectAppointment: (appointment: AppointmentDto) => void;
  onSelectRange: (selection: CalendarSlotSelection) => void;
}

/**
 * FullCalendar-backed calendar view (day grid + time grid + interaction, per the required
 * tech stack). Each appointment maps to an event tinted/bordered by status (never color
 * alone — the status label is always part of the visible title text too).
 */
export function CalendarView({
  appointments,
  canCreate,
  onRangeChange,
  onSelectAppointment,
  onSelectRange,
}: CalendarViewProps) {
  const events = useMemo<EventInput[]>(
    () =>
      appointments.map((appointment) => ({
        id: appointment.id,
        title: `${APPOINTMENT_STATUS_LABEL[appointment.status]} · ${appointment.patient?.fullName ?? 'Patient'} · Dr. ${appointment.doctorName ?? '—'}`,
        start: `${appointment.date}T${appointment.windowStart}:00`,
        end: `${appointment.date}T${appointment.windowEnd}:00`,
        backgroundColor: appointmentStatusTint(appointment.status),
        borderColor: appointmentStatusColor(appointment.status),
        textColor: 'rgb(var(--text-primary))',
        extendedProps: { appointment },
      })),
    [appointments],
  );

  function handleSelect(info: DateSelectArg) {
    onSelectRange({
      date: format(info.start, 'yyyy-MM-dd'),
      windowStart: info.allDay ? '09:00' : format(info.start, 'HH:mm'),
      windowEnd: info.allDay ? '09:30' : format(info.end, 'HH:mm'),
    });
  }

  function handleDateClick(info: DateClickArg) {
    onSelectRange({
      date: format(info.date, 'yyyy-MM-dd'),
      windowStart: info.allDay ? '09:00' : format(info.date, 'HH:mm'),
      windowEnd: info.allDay ? '09:30' : format(addMinutes(info.date, 30), 'HH:mm'),
    });
  }

  function handleEventClick(info: EventClickArg) {
    onSelectAppointment(info.event.extendedProps.appointment as AppointmentDto);
  }

  function handleDatesSet(info: DatesSetArg) {
    onRangeChange({ from: format(info.start, 'yyyy-MM-dd'), to: format(info.end, 'yyyy-MM-dd') });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-2 sm:p-4">
      <div className="min-w-[640px] [&_.fc]:font-sans">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="auto"
          nowIndicator
          selectable={canCreate}
          selectMirror
          dayMaxEvents
          events={events}
          select={canCreate ? handleSelect : undefined}
          dateClick={canCreate ? handleDateClick : undefined}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
        />
      </div>
    </div>
  );
}

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarDays, Footprints, Grid3x3, ListChecks, Plus, UserX } from 'lucide-react';
import { PERMISSIONS, type AppointmentDto } from '@clinicos/types';
import { Button, PageHeader } from '../../../components/ui';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { useAppointmentsQuery } from '../api';
import { CalendarView, type CalendarRangeChange } from '../components/CalendarView';
import { TodayAgendaView } from '../components/TodayAgendaView';
import { WalkInsView } from '../components/WalkInsView';
import { NoShowsView } from '../components/NoShowsView';
import { DoctorAvailabilityView } from '../components/DoctorAvailabilityView';
import { NewAppointmentDialog, type NewAppointmentPrefill } from '../components/NewAppointmentDialog';
import { AppointmentDetailsDialog } from '../components/AppointmentDetailsDialog';

const TABS = [
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'today', label: 'Today', icon: ListChecks },
  { key: 'walkins', label: 'Walk-Ins', icon: Footprints },
  { key: 'noshows', label: 'No-Shows', icon: UserX },
  { key: 'availability', label: 'Doctor Availability', icon: Grid3x3 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function AppointmentsPage() {
  const { has } = usePermission();
  const [tab, setTab] = useState<TabKey>('calendar');
  const [range, setRange] = useState<CalendarRangeChange>({ from: TODAY, to: TODAY });
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDto | null>(null);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [prefill, setPrefill] = useState<NewAppointmentPrefill | undefined>(undefined);

  const canCreate = has(PERMISSIONS.APPOINTMENT_CREATE);
  const calendarQuery = useAppointmentsQuery({ from: range.from, to: range.to });

  function openNewAppointment(prefillValues?: NewAppointmentPrefill) {
    if (!canCreate) return;
    setPrefill(prefillValues);
    setNewAppointmentOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Book, reschedule, and track appointment windows across doctors."
        actions={
          canCreate ? (
            <Button onClick={() => openNewAppointment()}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Appointment
            </Button>
          ) : undefined
        }
      />

      <div role="tablist" aria-label="Appointment views" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`appointments-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`appointments-panel-${key}`}
            className={`flex min-h-[44px] items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setTab(key)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="appointments-panel-calendar"
        aria-labelledby="appointments-tab-calendar"
        hidden={tab !== 'calendar'}
      >
        {tab === 'calendar' && (
          <QueryBoundary
            isLoading={calendarQuery.isLoading}
            isError={calendarQuery.isError}
            data={calendarQuery.data}
            onRetry={() => void calendarQuery.refetch()}
            loadingFallback={<div className="h-96 animate-pulse rounded-lg bg-surface-muted" />}
          >
            {(appointments) => (
              <CalendarView
                appointments={appointments}
                canCreate={canCreate}
                onRangeChange={setRange}
                onSelectAppointment={setSelectedAppointment}
                onSelectRange={({ date, windowStart, windowEnd }) => openNewAppointment({ date, windowStart, windowEnd })}
              />
            )}
          </QueryBoundary>
        )}
      </div>

      <div role="tabpanel" id="appointments-panel-today" aria-labelledby="appointments-tab-today" hidden={tab !== 'today'}>
        {tab === 'today' && <TodayAgendaView date={TODAY} onSelectAppointment={setSelectedAppointment} />}
      </div>

      <div
        role="tabpanel"
        id="appointments-panel-walkins"
        aria-labelledby="appointments-tab-walkins"
        hidden={tab !== 'walkins'}
      >
        {tab === 'walkins' && <WalkInsView />}
      </div>

      <div
        role="tabpanel"
        id="appointments-panel-noshows"
        aria-labelledby="appointments-tab-noshows"
        hidden={tab !== 'noshows'}
      >
        {tab === 'noshows' && <NoShowsView onSelectAppointment={setSelectedAppointment} />}
      </div>

      <div
        role="tabpanel"
        id="appointments-panel-availability"
        aria-labelledby="appointments-tab-availability"
        hidden={tab !== 'availability'}
      >
        {tab === 'availability' && (
          <DoctorAvailabilityView
            onSelectSlot={({ doctorId, date, windowStart, windowEnd }) =>
              openNewAppointment({ doctorId, date, windowStart, windowEnd })
            }
          />
        )}
      </div>

      {canCreate && (
        <NewAppointmentDialog
          open={newAppointmentOpen}
          onOpenChange={(nextOpen) => {
            setNewAppointmentOpen(nextOpen);
            if (!nextOpen) setPrefill(undefined);
          }}
          prefill={prefill}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailsDialog appointment={selectedAppointment} onClose={() => setSelectedAppointment(null)} />
      )}
    </div>
  );
}

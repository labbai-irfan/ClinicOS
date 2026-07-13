import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, MapPin, Plus, Stethoscope } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusPill } from '../../../components/ui/StatusPill';
import { useNavigate } from 'react-router-dom';
import { usePatientAppointmentsQuery } from '../api';

type AppointmentFilter = 'all' | 'upcoming' | 'past' | 'cancelled';

const TABS = [
  { key: 'upcoming' as const, label: 'Upcoming' },
  { key: 'past' as const, label: 'Past' },
  { key: 'all' as const, label: 'All' },
];

export default function PatientAppointmentsPage() {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<AppointmentFilter>('upcoming');
  const appointmentsQuery = usePatientAppointmentsQuery();

  const filteredAppointments = useMemo(() => {
    if (!appointmentsQuery.data) return [];

    const now = new Date();
    let filtered = appointmentsQuery.data;

    if (selectedTab === 'upcoming') {
      filtered = filtered.filter((a) => new Date(a.windowStart) > now && a.status !== 'cancelled');
    } else if (selectedTab === 'past') {
      filtered = filtered.filter((a) => new Date(a.windowStart) <= now || a.status === 'cancelled');
    }

    return filtered.sort(
      (a, b) => new Date(b.windowStart).getTime() - new Date(a.windowStart).getTime(),
    );
  }, [appointmentsQuery.data, selectedTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Appointments"
        description="View and manage your appointments"
        actions={
          <Button onClick={() => navigate('/book-appointment')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Book Appointment
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedTab(key)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              selectedTab === key
                ? 'border-b-2 border-primary text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <QueryBoundary
        isLoading={appointmentsQuery.isLoading}
        isError={appointmentsQuery.isError}
        data={appointmentsQuery.data}
        onRetry={() => appointmentsQuery.refetch()}
        loadingFallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-muted" />
            ))}
          </div>
        }
      >
        {() => {
          if (filteredAppointments.length === 0) {
            return (
              <Card>
                <div className="p-8">
                  <EmptyState
                    icon={Calendar}
                    title={selectedTab === 'upcoming' ? 'No upcoming appointments' : 'No appointments found'}
                    description={
                      selectedTab === 'upcoming'
                        ? "You don't have any upcoming appointments. Book one now!"
                        : `You don't have any ${selectedTab === 'past' ? 'past' : ''} appointments.`
                    }
                    action={
                      selectedTab === 'upcoming' ? (
                        <Button onClick={() => navigate('/book-appointment')}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Book an appointment
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              </Card>
            );
          }

          return (
            <div className="space-y-3">
              {filteredAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: any }) {
  const navigate = useNavigate();
  const appointmentDate = parseISO(appointment.windowStart);
  const isUpcoming = appointmentDate > new Date() && appointment.status !== 'cancelled';

  const statusTone = appointment.status === 'cancelled' ? 'danger' : 'success';

  return (
    <Card className="overflow-hidden hover:bg-surface-hover transition-colors">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="mt-1 flex-shrink-0 rounded-lg bg-primary/10 p-2">
              <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-primary">
                {appointment.doctorName || 'Appointment'}
              </h3>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Calendar className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {format(appointmentDate, 'MMMM d, yyyy')}
                </div>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  {format(appointmentDate, 'h:mm a')}
                </div>
                {appointment.location && (
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    {appointment.location}
                  </div>
                )}
              </div>
              {appointment.notes && (
                <p className="mt-2 text-sm text-text-secondary">{appointment.notes}</p>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-3">
            <StatusPill label={appointment.status} tone={statusTone} />
            {isUpcoming && (
              <Button variant="outline" size="sm">
                Reschedule
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

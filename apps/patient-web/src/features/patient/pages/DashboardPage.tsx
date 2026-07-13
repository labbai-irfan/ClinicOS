import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Calendar, FileText, Plus, Stethoscope } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { EmptyState } from '../../../components/ui/EmptyState';
import { usePatientMeQuery, usePatientAppointmentsQuery, usePatientPrescriptionsQuery } from '../api';

export default function PatientDashboardPage() {
  const patientQuery = usePatientMeQuery();
  const appointmentsQuery = usePatientAppointmentsQuery();
  const prescriptionsQuery = usePatientPrescriptionsQuery({ status: 'active' });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const patientName = patientQuery.data?.fullName?.split(' ')[0] || 'Patient';
  const title = `${greeting}, ${patientName}`;

  return (
    <div className="min-w-0">
      <PageHeader
        title={title}
        description={format(new Date(), 'EEEE, d MMMM yyyy')}
      />

      <div className="space-y-6">
        <UpcomingAppointmentsSection appointmentsQuery={appointmentsQuery} />
        <RecentPrescriptionsSection prescriptionsQuery={prescriptionsQuery} />
      </div>
    </div>
  );
}

function UpcomingAppointmentsSection({
  appointmentsQuery,
}: {
  appointmentsQuery: ReturnType<typeof usePatientAppointmentsQuery>;
}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Upcoming Appointments</h2>
        <Button size="sm" variant="outline" onClick={() => navigate('/appointments/new')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Book Appointment
        </Button>
      </div>

      <QueryBoundary
        isLoading={appointmentsQuery.isLoading}
        isError={appointmentsQuery.isError}
        data={appointmentsQuery.data}
        onRetry={() => appointmentsQuery.refetch()}
        loadingFallback={<div className="h-40 animate-pulse rounded-lg bg-surface-muted" />}
      >
        {(appointments) => {
          const upcomingAppointments = appointments
            .filter((a) => new Date(a.windowStart) > new Date())
            .sort((a, b) => new Date(a.windowStart).getTime() - new Date(b.windowStart).getTime())
            .slice(0, 3);

          if (upcomingAppointments.length === 0) {
            return (
              <Card>
                <div className="p-8">
                  <EmptyState
                    icon={Calendar}
                    title="No upcoming appointments"
                    description="You don't have any upcoming appointments scheduled."
                    action={
                      <Button onClick={() => navigate('/appointments/new')}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Book an appointment
                      </Button>
                    }
                  />
                </div>
              </Card>
            );
          }

          return (
            <div className="grid gap-3">
              {upcomingAppointments.map((appointment) => (
                <Card key={appointment.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <Stethoscope className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary">
                          {appointment.doctorName || 'Appointment'}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {format(parseISO(appointment.windowStart), 'MMM d, yyyy')} at{' '}
                          {format(parseISO(appointment.windowStart), 'h:mm a')}
                        </p>
                        {appointment.patientNotes && (
                          <p className="mt-1 text-sm text-text-secondary">{appointment.patientNotes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function RecentPrescriptionsSection({
  prescriptionsQuery,
}: {
  prescriptionsQuery: ReturnType<typeof usePatientPrescriptionsQuery>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Active Prescriptions</h2>

      <QueryBoundary
        isLoading={prescriptionsQuery.isLoading}
        isError={prescriptionsQuery.isError}
        data={prescriptionsQuery.data}
        onRetry={() => prescriptionsQuery.refetch()}
        loadingFallback={<div className="h-40 animate-pulse rounded-lg bg-surface-muted" />}
      >
        {(prescriptions) => {
          if (prescriptions.length === 0) {
            return (
              <Card>
                <div className="p-8">
                  <EmptyState
                    icon={FileText}
                    title="No active prescriptions"
                    description="You don't have any active prescriptions at the moment."
                  />
                </div>
              </Card>
            );
          }

          return (
            <div className="grid gap-3">
              {prescriptions.slice(0, 3).map((prescription) => (
                <Card key={prescription.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="mt-0.5 flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary">
                          {prescription.doctorName || 'Dr. ' + prescription.id}
                        </p>
                        <p className="text-sm text-text-secondary">
                          {prescription.medicines.length} medicine{prescription.medicines.length !== 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Issued: {format(parseISO(prescription.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

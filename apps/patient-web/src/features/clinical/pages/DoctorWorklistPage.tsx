import { useNavigate } from 'react-router-dom';
import { ArrowRight, Stethoscope } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusPill } from '../../../components/ui/StatusPill';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useDoctorWorklistQuery } from '../api';
import { alertTone, queueStatusLabel, queueStatusTone } from '../utils';

export default function DoctorWorklistPage() {
  const navigate = useNavigate();
  const worklist = useDoctorWorklistQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Worklist"
        description="Patients ready for consultation, in priority and arrival order."
      />

      <QueryBoundary
        isLoading={worklist.isLoading}
        isError={worklist.isError}
        data={worklist.data}
        onRetry={() => void worklist.refetch()}
        isEmpty={(data) => data.length === 0}
        emptyTitle="No patients ready"
        emptyDescription="Patients who have completed nurse assessment will appear here."
      >
        {(entries) => (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-text-secondary">{entry.token}</span>
                      <h3 className="truncate text-base font-semibold text-text-primary">
                        {entry.patientName ?? 'Unknown patient'}
                      </h3>
                      {entry.age !== undefined && (
                        <span className="text-sm text-text-secondary">{entry.age} yrs</span>
                      )}
                      <StatusPill label={queueStatusLabel(entry.status)} tone={queueStatusTone(entry.status)} />
                    </div>
                    {entry.reasonForVisit && (
                      <p className="text-sm text-text-secondary">{entry.reasonForVisit}</p>
                    )}
                    {entry.alerts && entry.alerts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {entry.alerts.map((alert, i) => (
                          <StatusPill key={i} label={alert.label} tone={alertTone(alert.severity)} />
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="lg" onClick={() => navigate(`/clinical/doctor/${entry.id}`)}>
                    <Stethoscope className="h-4 w-4" aria-hidden="true" />
                    {entry.status === 'in_consultation' ? 'Resume Consultation' : 'Start Consultation'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

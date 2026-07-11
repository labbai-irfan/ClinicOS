import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, UserRound } from 'lucide-react';
import { PERMISSIONS } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardContent } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { useEmergencyCaseQuery } from '../api';
import { useTickingClock } from '../lib/use-ticking-clock';
import {
  ARRIVAL_MODE_LABELS,
  GENDER_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  formatElapsed,
} from '../lib/status-meta';
import { StatusTransitionBar } from '../components/StatusTransitionBar';
import { TriagePanel } from '../components/TriagePanel';
import { AssignPanel } from '../components/AssignPanel';
import { ReferralDialog } from '../components/ReferralDialog';
import { ObservationPanel } from '../components/ObservationPanel';
import { TimelineList } from '../components/TimelineList';

export default function EmergencyCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { has } = usePermission();
  const caseQuery = useEmergencyCaseQuery(caseId);
  const now = useTickingClock();

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/emergency"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to board
      </Link>

      <QueryBoundary
        isLoading={caseQuery.isLoading}
        isError={caseQuery.isError || !caseId}
        data={caseQuery.data}
        onRetry={() => caseQuery.refetch()}
      >
        {(emergencyCase) => {
          const canTriage = has(PERMISSIONS.EMERGENCY_TRIAGE);
          const canAssign = has(PERMISSIONS.EMERGENCY_ASSIGN);
          const canManage = has(PERMISSIONS.EMERGENCY_MANAGE);
          const showTriage =
            canTriage &&
            (emergencyCase.status === 'awaiting_triage' || emergencyCase.status === 'triage_in_progress');
          const showObservation = canManage && emergencyCase.status === 'under_observation';

          return (
            <div className="space-y-5">
              <PageHeader
                title={`${emergencyCase.caseCode} · ${emergencyCase.patientLabel}`}
                description={emergencyCase.mainConcern}
                actions={canManage ? <ReferralDialog caseId={emergencyCase.id} /> : undefined}
              />

              <Card>
                <CardContent className="space-y-4 pt-4 sm:pt-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill
                      tone={PRIORITY_TONES[emergencyCase.priority]}
                      label={PRIORITY_LABELS[emergencyCase.priority]}
                    />
                    <StatusPill
                      tone={STATUS_TONES[emergencyCase.status]}
                      label={STATUS_LABELS[emergencyCase.status]}
                    />
                    {emergencyCase.nextAction && (
                      <span className="text-sm font-medium text-text-primary">
                        Next: {emergencyCase.nextAction}
                      </span>
                    )}
                  </div>

                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        Arrived {formatElapsed(emergencyCase.arrivalAt, now)} ago ·{' '}
                        {ARRIVAL_MODE_LABELS[emergencyCase.arrivalMode]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {GENDER_LABELS[emergencyCase.gender]}
                        {emergencyCase.approximateAge !== undefined
                          ? ` · approx. ${emergencyCase.approximateAge}y`
                          : ''}
                      </span>
                    </div>
                    {emergencyCase.latestVitalsSummary && (
                      <div className="text-text-secondary sm:col-span-2">
                        <span className="font-medium text-text-primary">Latest vitals: </span>
                        {emergencyCase.latestVitalsSummary}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-text-secondary">
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Doctor: {emergencyCase.assignedDoctorName ?? 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Nurse: {emergencyCase.assignedNurseName ?? 'Unassigned'}</span>
                    </div>
                  </dl>

                  {canManage && (
                    <div className="border-t border-border pt-4">
                      <StatusTransitionBar caseId={emergencyCase.id} currentStatus={emergencyCase.status} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {showTriage && <TriagePanel caseId={emergencyCase.id} currentPriority={emergencyCase.priority} />}

              {showObservation && <ObservationPanel caseId={emergencyCase.id} />}

              {canAssign && (
                <AssignPanel
                  caseId={emergencyCase.id}
                  assignedDoctorId={emergencyCase.assignedDoctorId}
                  assignedNurseId={emergencyCase.assignedNurseId}
                />
              )}

              <TimelineList caseId={emergencyCase.id} />
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

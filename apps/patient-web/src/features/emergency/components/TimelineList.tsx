import { format } from 'date-fns';
import { History } from 'lucide-react';
import { EMERGENCY_STATUSES } from '@clinicos/types';
import type { EmergencyStatus } from '@clinicos/types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useEmergencyEventsQuery } from '../api';
import { STATUS_LABELS } from '../lib/status-meta';

const ACTION_LABELS: Record<string, string> = {
  arrival: 'Arrived',
  triage: 'Triage recorded',
  assigned: 'Staff assigned',
  referral_initiated: 'Referral initiated',
  observation_note: 'Observation note',
};

function isEmergencyStatus(action: string): action is EmergencyStatus {
  return (EMERGENCY_STATUSES as readonly string[]).includes(action);
}

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (isEmergencyStatus(action)) return `Moved to: ${STATUS_LABELS[action]}`;
  return action.replace(/_/g, ' ');
}

/**
 * Case timeline (spec §19). Built defensively: whether the events endpoint errors or
 * simply returns nothing yet, this renders the same calm empty state instead of
 * blocking the rest of the case page.
 */
export function TimelineList({ caseId }: { caseId: string }) {
  const eventsQuery = useEmergencyEventsQuery(caseId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-text-secondary" aria-hidden="true" />
          <CardTitle>Case timeline</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {eventsQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : eventsQuery.isError || !eventsQuery.data || eventsQuery.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="No timeline events yet"
            description="Activity for this case will appear here as it happens."
          />
        ) : (
          <ol className="space-y-3">
            {[...eventsQuery.data].reverse().map((event) => (
              <li key={event.id} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium text-text-primary">{actionLabel(event.action)}</span>
                  <time dateTime={event.createdAt} className="text-xs text-text-secondary">
                    {format(new Date(event.createdAt), 'd MMM, h:mm a')}
                  </time>
                </div>
                {event.notes && <p className="mt-0.5 text-sm text-text-secondary">{event.notes}</p>}
                {event.actorName && <p className="mt-0.5 text-xs text-text-secondary">by {event.actorName}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

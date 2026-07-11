import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, Siren, UserRound } from 'lucide-react';
import { PERMISSIONS, type EmergencyPriority } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Card } from '../../../components/ui/Card';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { cn } from '../../../lib/utils';
import { useEmergencyBoardQuery } from '../api';
import { useTickingClock } from '../lib/use-ticking-clock';
import {
  GENDER_LABELS,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  STATUS_LABELS,
  STATUS_TONES,
  formatElapsed,
} from '../lib/status-meta';

/**
 * The one place priority gets a colored accent (spec §20) — a subtle left-border strip,
 * not a wash of red across the whole board. Everything else stays neutral and calm.
 */
const PRIORITY_BORDER: Record<EmergencyPriority, string> = {
  critical: 'border-l-danger',
  urgent: 'border-l-warning',
  standard: 'border-l-info',
  unconfirmed: 'border-l-border',
};

export default function EmergencyBoardPage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const boardQuery = useEmergencyBoardQuery();
  const now = useTickingClock();

  return (
    <div>
      <PageHeader
        title="Emergency"
        description="Active emergency cases, oldest arrival first."
        actions={
          has(PERMISSIONS.EMERGENCY_CREATE) ? (
            <Button type="button" onClick={() => navigate('/emergency/new')}>
              <Siren className="h-4 w-4" aria-hidden="true" />
              Emergency Entry
            </Button>
          ) : undefined
        }
      />

      <QueryBoundary
        isLoading={boardQuery.isLoading}
        isError={boardQuery.isError}
        data={boardQuery.data}
        onRetry={() => boardQuery.refetch()}
        isEmpty={(data) => data.length === 0}
        emptyTitle="No active emergency cases"
        emptyDescription="Every case is resolved. New arrivals will appear here immediately."
      >
        {(cases) => (
          <Card className="divide-y divide-border overflow-hidden">
            {cases.map((c) => {
              const assignees = [c.assignedDoctorName, c.assignedNurseName].filter(Boolean).join(' · ');
              return (
                <Link
                  key={c.id}
                  to={`/emergency/${c.id}`}
                  className={cn(
                    'flex flex-col gap-3 border-l-4 p-4 transition-colors hover:bg-surface-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
                    'sm:flex-row sm:items-center sm:gap-6 sm:p-5',
                    PRIORITY_BORDER[c.priority],
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-text-primary">{c.caseCode}</span>
                      <StatusPill tone={PRIORITY_TONES[c.priority]} label={PRIORITY_LABELS[c.priority]} />
                      <StatusPill tone={STATUS_TONES[c.status]} label={STATUS_LABELS[c.status]} />
                    </div>
                    <p className="mt-1 truncate text-sm text-text-secondary">
                      {c.patientLabel}
                      {c.approximateAge !== undefined ? ` · approx. ${c.approximateAge}y` : ''} ·{' '}
                      {GENDER_LABELS[c.gender]}
                    </p>
                    {c.nextAction && (
                      <p className="mt-1 text-sm font-medium text-text-primary">{c.nextAction}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-4 text-sm text-text-secondary sm:gap-6">
                    <span className="flex items-center gap-1.5" title="Time since arrival">
                      <Clock className="h-4 w-4" aria-hidden="true" />
                      <span className="tabular-nums">{formatElapsed(c.arrivalAt, now)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      {assignees || 'Unassigned'}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}

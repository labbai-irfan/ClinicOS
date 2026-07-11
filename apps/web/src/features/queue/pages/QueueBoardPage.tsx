import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { LayoutGrid, List, Plus, RefreshCw } from 'lucide-react';
import { PERMISSIONS, QUEUE_BOARD_COLUMNS } from '@clinicos/types';
import type { QueueEntryDto } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/Tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useQueueBoardQuery, useTransitionMutation } from '../api';
import { QueueCard, type QueueCardActions } from '../components/QueueCard';
import { AddWalkInDialog } from '../components/AddWalkInDialog';
import { CallPatientDialog } from '../components/CallPatientDialog';
import { SkipDialog } from '../components/SkipDialog';
import { RejoinDialog } from '../components/RejoinDialog';
import { TransitionConfirmDialog, type TransitionConfirmRequest } from '../components/TransitionConfirmDialog';
import { QUEUE_BOARD_COLUMN_LABELS, type QueueBoardColumn } from '../queue-labels';

type BoardView = 'board' | 'list';

export default function QueueBoardPage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.QUEUE_MANAGE);
  const canOverride = has(PERMISSIONS.QUEUE_OVERRIDE);

  const [view, setView] = useState<BoardView>('board');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [addWalkInOpen, setAddWalkInOpen] = useState(false);
  const [callEntry, setCallEntry] = useState<QueueEntryDto | null>(null);
  const [skipEntry, setSkipEntry] = useState<QueueEntryDto | null>(null);
  const [rejoinEntry, setRejoinEntry] = useState<QueueEntryDto | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<TransitionConfirmRequest | null>(null);

  // Forces a re-render every 30s so "Waiting X minutes" keeps advancing between polls.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const board = useQueueBoardQuery(today, view);
  const transition = useTransitionMutation();

  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of board.data ?? []) {
      if (entry.doctorId) map.set(entry.doctorId, entry.doctorName ?? entry.doctorId);
    }
    return Array.from(map.entries());
  }, [board.data]);

  const visibleEntries = useMemo(() => {
    const entries = board.data ?? [];
    return doctorFilter === 'all' ? entries : entries.filter((e) => e.doctorId === doctorFilter);
  }, [board.data, doctorFilter]);

  const attentionEntries = useMemo(
    () => visibleEntries.filter((e) => e.status === 'skipped' || e.status === 'temporarily_away'),
    [visibleEntries],
  );

  const runTransition = async (entry: QueueEntryDto, to: QueueEntryDto['status'], successMessage: string) => {
    try {
      await transition.mutateAsync({ id: entry.id, to, expectedVersion: entry.version });
      toast.success(successMessage, `Token ${entry.token}`);
    } catch (err) {
      toast.error('Action failed', apiErrorMessage(err));
    }
  };

  const cardActions = {
    onStartNurseAssessment: (entry: QueueEntryDto) =>
      runTransition(entry, 'nurse_assessment', 'Nurse assessment started'),
    onReadyForDoctor: (entry: QueueEntryDto) =>
      runTransition(entry, 'ready_for_doctor', 'Marked ready for doctor'),
    onCallPatient: (entry: QueueEntryDto) => setCallEntry(entry),
    onStartConsultation: async (entry: QueueEntryDto) => {
      try {
        await transition.mutateAsync({ id: entry.id, to: 'in_consultation', expectedVersion: entry.version });
        toast.success('Consultation started', `Token ${entry.token}`);
        navigate(`/clinical/doctor/${entry.id}`);
      } catch (err) {
        toast.error('Could not start consultation', apiErrorMessage(err));
      }
    },
    onSkip: (entry: QueueEntryDto) => setSkipEntry(entry),
    onNoShow: (entry: QueueEntryDto) =>
      setConfirmRequest({
        entry,
        to: 'no_show',
        title: `Mark token ${entry.token} as no-show`,
        confirmLabel: 'Mark No-Show',
        successMessage: 'Marked as no-show',
      }),
    onCancel: (entry: QueueEntryDto) =>
      setConfirmRequest({
        entry,
        to: 'cancelled',
        title: `Cancel token ${entry.token}`,
        confirmLabel: 'Cancel Entry',
        successMessage: 'Queue entry cancelled',
      }),
    onRejoin: (entry: QueueEntryDto) => setRejoinEntry(entry),
  };

  return (
    <div>
      <PageHeader
        title="Live Queue"
        description="Today's patient flow across nursing and consultation."
        actions={
          <>
            <IconButton label="Refresh queue" icon={RefreshCw} onClick={() => board.refetch()} />
            <div className="flex overflow-hidden rounded border border-border">
              <Button
                type="button"
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setView('board')}
              >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                Board
              </Button>
              <Button
                type="button"
                variant={view === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none"
                onClick={() => setView('list')}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                List
              </Button>
            </div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-48" aria-label="Filter by doctor">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {doctorOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={() => setAddWalkInOpen(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Walk-In
              </Button>
            )}
          </>
        }
      />

      <QueryBoundary
        isLoading={board.isLoading}
        isError={board.isError}
        data={visibleEntries}
        onRetry={() => board.refetch()}
        isEmpty={(data) => data.length === 0}
        emptyTitle="No patients in the queue yet"
        emptyDescription="Add a walk-in or wait for scheduled check-ins to appear here."
      >
        {(entries) => (
          <div className="space-y-6">
            {attentionEntries.length > 0 && (
              <Card>
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm font-semibold text-text-primary">
                    Needs attention ({attentionEntries.length})
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {attentionEntries.map((entry) => (
                      <div key={entry.id} className="w-72 shrink-0">
                        <QueueCard entry={entry} canManage={canManage} {...cardActions} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {view === 'board' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {QUEUE_BOARD_COLUMNS.map((column) => (
                  <BoardColumn
                    key={column}
                    column={column}
                    entries={entries.filter((e) => e.status === column)}
                    canManage={canManage}
                    actions={cardActions}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <QueueCard key={entry.id} entry={entry} canManage={canManage} {...cardActions} />
                ))}
              </div>
            )}
          </div>
        )}
      </QueryBoundary>

      <AddWalkInDialog open={addWalkInOpen} onClose={() => setAddWalkInOpen(false)} />
      <CallPatientDialog entry={callEntry} onClose={() => setCallEntry(null)} />
      <SkipDialog entry={skipEntry} onClose={() => setSkipEntry(null)} />
      <RejoinDialog entry={rejoinEntry} canOverride={canOverride} onClose={() => setRejoinEntry(null)} />
      <TransitionConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </div>
  );
}

function BoardColumn({
  column,
  entries,
  canManage,
  actions,
}: {
  column: QueueBoardColumn;
  entries: QueueEntryDto[];
  canManage: boolean;
  actions: QueueCardActions;
}) {
  return (
    <div className="flex min-h-[16rem] flex-col rounded-lg border border-border bg-surface-muted/40 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-text-primary">{QUEUE_BOARD_COLUMN_LABELS[column]}</h2>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
          {entries.length}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto">
        {entries.length === 0 ? (
          <EmptyState title="No patients" />
        ) : (
          entries.map((entry) => (
            <QueueCard key={entry.id} entry={entry} canManage={canManage} {...actions} />
          ))
        )}
      </div>
    </div>
  );
}

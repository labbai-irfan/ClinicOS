import { formatDistanceToNow } from 'date-fns';
import type { QueueEntryDto } from '@clinicos/types';
import { ClipboardList, PhoneCall, PlayCircle, RotateCcw, SkipForward, UserX, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { QUEUE_SOURCE_LABELS, QUEUE_STATUS_LABELS, QUEUE_STATUS_TONE } from '../queue-labels';

export interface QueueCardActions {
  onStartNurseAssessment: (entry: QueueEntryDto) => void;
  onReadyForDoctor: (entry: QueueEntryDto) => void;
  onCallPatient: (entry: QueueEntryDto) => void;
  onStartConsultation: (entry: QueueEntryDto) => void;
  onSkip: (entry: QueueEntryDto) => void;
  onNoShow: (entry: QueueEntryDto) => void;
  onCancel: (entry: QueueEntryDto) => void;
  onRejoin: (entry: QueueEntryDto) => void;
}

interface QueueCardProps extends QueueCardActions {
  entry: QueueEntryDto;
  /** Hides every mutating action for staff without queue.manage. */
  canManage: boolean;
}

/** Compact, touch-friendly queue card used on both the Kanban board and the flat list view. */
export function QueueCard({ entry, canManage, ...actions }: QueueCardProps) {
  const waitingSince = entry.checkedInAt ?? entry.createdAt;
  const waitingLabel = formatDistanceToNow(new Date(waitingSince));
  const reasonLabel = entry.reasonForVisit || QUEUE_SOURCE_LABELS[entry.source];

  return (
    <Card className="w-full">
      <CardHeader className="p-3 pb-2">
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight text-text-primary">{entry.token}</p>
          <p className="truncate text-sm text-text-secondary">
            {entry.patientName ?? entry.patientCode ?? 'Patient'}
            {entry.age !== undefined ? ` · ${entry.age}y` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusPill label={QUEUE_STATUS_LABELS[entry.status]} tone={QUEUE_STATUS_TONE[entry.status]} />
          {entry.priority > 0 && (
            <StatusPill
              label={`Priority ${entry.priority}`}
              tone={entry.priority >= 5 ? 'danger' : 'warning'}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3 pt-0">
        <p className="truncate text-sm text-text-secondary">{reasonLabel}</p>
        {entry.doctorName && <p className="truncate text-sm text-text-secondary">Dr. {entry.doctorName}</p>}
        <p className="text-xs text-text-secondary">Waiting {waitingLabel}</p>

        {canManage && (
          <div className="flex flex-wrap gap-2 pt-2">{renderActions(entry, actions)}</div>
        )}
      </CardContent>
    </Card>
  );
}

function renderActions(entry: QueueEntryDto, actions: QueueCardActions) {
  switch (entry.status) {
    case 'waiting_for_nurse':
      return (
        <>
          <Button size="sm" onClick={() => actions.onStartNurseAssessment(entry)}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Start Nurse Assessment
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.onSkip(entry)}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onNoShow(entry)}>
            <UserX className="h-4 w-4" aria-hidden="true" />
            No-Show
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </>
      );
    case 'nurse_assessment':
      return (
        <>
          <Button size="sm" onClick={() => actions.onReadyForDoctor(entry)}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Mark Ready for Doctor
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </>
      );
    case 'ready_for_doctor':
      return (
        <>
          <Button size="sm" onClick={() => actions.onCallPatient(entry)}>
            <PhoneCall className="h-4 w-4" aria-hidden="true" />
            Call Patient
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.onSkip(entry)}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onNoShow(entry)}>
            <UserX className="h-4 w-4" aria-hidden="true" />
            No-Show
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </>
      );
    case 'waiting_for_doctor':
      return (
        <>
          <Button size="sm" onClick={() => actions.onStartConsultation(entry)}>
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Start Consultation
          </Button>
          <Button size="sm" variant="outline" onClick={() => actions.onSkip(entry)}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onNoShow(entry)}>
            <UserX className="h-4 w-4" aria-hidden="true" />
            No-Show
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </>
      );
    case 'billing_pending':
      return (
        <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
      );
    case 'skipped':
    case 'temporarily_away':
      return (
        <>
          <Button size="sm" onClick={() => actions.onRejoin(entry)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rejoin
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onNoShow(entry)}>
            <UserX className="h-4 w-4" aria-hidden="true" />
            No-Show
          </Button>
          <Button size="sm" variant="ghost" onClick={() => actions.onCancel(entry)}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Cancel
          </Button>
        </>
      );
    default:
      return null;
  }
}

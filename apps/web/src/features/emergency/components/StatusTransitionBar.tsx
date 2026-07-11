import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { EMERGENCY_TRANSITIONS } from '@clinicos/types';
import type { EmergencyStatus } from '@clinicos/types';
import { Button } from '../../../components/ui/Button';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useTransitionMutation } from '../api';
import { STATUS_LABELS } from '../lib/status-meta';

/**
 * Renders one button per valid next status (spec §19) — EMERGENCY_TRANSITIONS is the
 * single source of truth for which moves are legal from the case's current status.
 */
export function StatusTransitionBar({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: EmergencyStatus;
}) {
  const nextStatuses = EMERGENCY_TRANSITIONS[currentStatus] ?? [];
  const [target, setTarget] = useState<EmergencyStatus | null>(null);
  const [notes, setNotes] = useState('');
  const transition = useTransitionMutation(caseId);

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-text-secondary">This case is closed — no further status changes.</p>
    );
  }

  const closeDialog = () => {
    setTarget(null);
    setNotes('');
  };

  const confirm = async () => {
    if (!target) return;
    try {
      await transition.mutateAsync({ to: target, notes: notes.trim() || undefined });
      toast.success('Status updated', `Case moved to ${STATUS_LABELS[target]}.`);
      closeDialog();
    } catch (err) {
      toast.error('Could not update status', apiErrorMessage(err));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStatuses.map((status) => (
        <Button key={status} type="button" variant="outline" size="sm" onClick={() => setTarget(status)}>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          {STATUS_LABELS[status]}
        </Button>
      ))}

      <Dialog open={target !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          title={target ? `Move to: ${STATUS_LABELS[target]}` : 'Confirm status change'}
          description="Optionally add a note for the case timeline."
        >
          <div className="space-y-4">
            <Field label="Notes" htmlFor="transition-notes" hint="Optional">
              <Textarea
                id="transition-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" loading={transition.isPending} onClick={confirm}>
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

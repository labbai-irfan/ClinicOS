import { useEffect, useState } from 'react';
import type { QueueEntryDto, QueueStatus } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useTransitionMutation } from '../api';

export interface TransitionConfirmRequest {
  entry: QueueEntryDto;
  to: QueueStatus;
  title: string;
  confirmLabel: string;
  successMessage: string;
}

/** Lightweight confirm dialog for simple, optional-reason transitions (no-show, cancel). */
export function TransitionConfirmDialog({
  request,
  onClose,
}: {
  request: TransitionConfirmRequest | null;
  onClose: () => void;
}) {
  const transition = useTransitionMutation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [request]);

  const close = () => {
    setReason('');
    onClose();
  };

  const confirm = async () => {
    if (!request) return;
    try {
      await transition.mutateAsync({
        id: request.entry.id,
        to: request.to,
        reason: reason.trim() || undefined,
        expectedVersion: request.entry.version,
      });
      toast.success(request.successMessage, `Token ${request.entry.token}`);
      close();
    } catch (err) {
      toast.error('Action failed', apiErrorMessage(err));
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(next) => !next && close()}>
      {request && (
        <DialogContent
          title={request.title}
          description={`Token ${request.entry.token} · ${request.entry.patientName ?? 'Patient'}`}
        >
          <div className="space-y-4">
            <Field label="Reason" htmlFor="transition-reason" hint="Optional, recorded in the queue history">
              <Textarea
                id="transition-reason"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Back
              </Button>
              <Button type="button" variant="danger" loading={transition.isPending} onClick={confirm}>
                {request.confirmLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

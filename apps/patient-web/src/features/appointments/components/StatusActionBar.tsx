import { useState } from 'react';
import { PERMISSIONS, type AppointmentDto, type AppointmentStatus } from '@clinicos/types';
import { Button, Dialog, DialogContent, Field, Textarea, toast } from '../../../components/ui';
import { usePermission } from '../../../hooks/use-permission';
import { apiErrorMessage } from '../../../lib/api-client';
import { useStatusMutation } from '../api';
import { APPOINTMENT_STATUS_LABEL, REASON_REQUIRED_STATUSES, nextStatusActions } from '../status';

interface StatusActionBarProps {
  appointment: AppointmentDto;
  size?: 'sm' | 'md';
}

/**
 * Quick status-change buttons shared by the Today agenda and the appointment details dialog.
 * Gated by `appointment.cancel` (status changes live alongside cancel/no-show per spec).
 * Cancel and no-show always route through a reason-required confirm dialog before submitting.
 */
export function StatusActionBar({ appointment, size = 'sm' }: StatusActionBarProps) {
  const { has } = usePermission();
  const statusMutation = useStatusMutation();
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);
  const [reason, setReason] = useState('');

  if (!has(PERMISSIONS.APPOINTMENT_CANCEL)) return null;
  const actions = nextStatusActions(appointment.status);
  if (actions.length === 0) return null;

  async function applyStatus(status: AppointmentStatus, statusReason?: string) {
    try {
      await statusMutation.mutateAsync({ id: appointment.id, status, reason: statusReason });
      toast.success(`Marked ${APPOINTMENT_STATUS_LABEL[status].toLowerCase()}`);
      setPendingStatus(null);
    } catch (error) {
      toast.error('Could not update appointment', apiErrorMessage(error));
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            size={size}
            variant={action.status === 'cancelled' || action.status === 'no_show' ? 'danger' : 'secondary'}
            loading={statusMutation.isPending && statusMutation.variables?.status === action.status}
            onClick={() => {
              if (REASON_REQUIRED_STATUSES.includes(action.status)) {
                setReason('');
                setPendingStatus(action.status);
              } else {
                void applyStatus(action.status);
              }
            }}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        {pendingStatus && (
          <DialogContent
            title={`${APPOINTMENT_STATUS_LABEL[pendingStatus]} appointment`}
            description="A reason is required and will be recorded in the audit log."
          >
            <div className="space-y-4">
              <Field label="Reason" htmlFor={`status-reason-${appointment.id}`} required>
                <Textarea
                  id={`status-reason-${appointment.id}`}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPendingStatus(null)}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={reason.trim().length === 0}
                  loading={statusMutation.isPending}
                  onClick={() => void applyStatus(pendingStatus, reason.trim())}
                >
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

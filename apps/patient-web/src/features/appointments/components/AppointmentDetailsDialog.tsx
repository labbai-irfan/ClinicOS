import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { rescheduleAppointmentSchema } from '@clinicos/validation';
import { PERMISSIONS, type AppointmentDto } from '@clinicos/types';
import { Button, Dialog, DialogContent, Field, Input, StatusPill, Textarea, toast } from '../../../components/ui';
import { usePermission } from '../../../hooks/use-permission';
import { apiErrorMessage } from '../../../lib/api-client';
import {
  apiErrorCode,
  useAvailableSlotsQuery,
  useRescheduleMutation,
  type RescheduleAppointmentInput,
} from '../api';
import {
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_STATUS_TONE,
  APPOINTMENT_TYPE_LABEL,
  RESCHEDULABLE_STATUSES,
} from '../status';
import { formatTimeLabel, recommendedArrivalLabel } from '../lib/time';
import { StatusActionBar } from './StatusActionBar';

interface AppointmentDetailsDialogProps {
  appointment: AppointmentDto;
  onClose: () => void;
}

export function AppointmentDetailsDialog({ appointment, onClose }: AppointmentDetailsDialogProps) {
  const { has } = usePermission();
  const [mode, setMode] = useState<'view' | 'reschedule'>('view');
  const [conflict, setConflict] = useState(false);
  const rescheduleMutation = useRescheduleMutation();

  const form = useForm<RescheduleAppointmentInput>({
    resolver: zodResolver(rescheduleAppointmentSchema),
    defaultValues: {
      date: appointment.date,
      windowStart: appointment.windowStart,
      windowEnd: appointment.windowEnd,
      reason: '',
      overrideCapacity: false,
    },
  });

  useEffect(() => {
    setMode('view');
    setConflict(false);
    form.reset({
      date: appointment.date,
      windowStart: appointment.windowStart,
      windowEnd: appointment.windowEnd,
      reason: '',
      overrideCapacity: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id]);

  const watchedDate = form.watch('date');
  const slotsQuery = useAvailableSlotsQuery({ doctorId: appointment.doctorId, date: watchedDate });
  const availableSlots = slotsQuery.data?.filter((slot) => slot.available) ?? [];

  const canReschedule = has(PERMISSIONS.APPOINTMENT_RESCHEDULE) && RESCHEDULABLE_STATUSES.includes(appointment.status);
  const canOverride = has(PERMISSIONS.APPOINTMENT_OVERRIDE);

  async function submitReschedule(values: RescheduleAppointmentInput) {
    try {
      await rescheduleMutation.mutateAsync({ id: appointment.id, input: values });
      toast.success('Appointment rescheduled');
      onClose();
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'DOUBLE_BOOKING' || code === 'CAPACITY_EXCEEDED') {
        setConflict(true);
      } else {
        toast.error('Could not reschedule', apiErrorMessage(error));
      }
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title={mode === 'reschedule' ? 'Reschedule Appointment' : 'Appointment Details'}
        description={mode === 'reschedule' ? 'Pick a new window; a reason is required and audited.' : undefined}
      >
        {mode === 'view' ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-text-primary">
                  {appointment.patient?.fullName ?? 'Patient'}
                </p>
                <p className="text-sm text-text-secondary">
                  {appointment.patient?.code}
                  {appointment.patient?.mobile ? ` · ${appointment.patient.mobile}` : ''}
                </p>
              </div>
              <StatusPill
                label={APPOINTMENT_STATUS_LABEL[appointment.status]}
                tone={APPOINTMENT_STATUS_TONE[appointment.status]}
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-text-secondary">Doctor</dt>
                <dd className="text-text-primary">{appointment.doctorName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Type</dt>
                <dd className="text-text-primary">{APPOINTMENT_TYPE_LABEL[appointment.type]}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Date</dt>
                <dd className="text-text-primary">{appointment.date}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Window</dt>
                <dd className="text-text-primary">
                  {formatTimeLabel(appointment.windowStart)}–{formatTimeLabel(appointment.windowEnd)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-text-secondary">Recommended patient arrival</dt>
                <dd className="text-text-primary">
                  {recommendedArrivalLabel(appointment)}{' '}
                  <span className="text-text-secondary">(about 10 min before the window — not an exact time)</span>
                </dd>
              </div>
              {appointment.reason && (
                <div className="col-span-2">
                  <dt className="text-text-secondary">Reason</dt>
                  <dd className="text-text-primary">{appointment.reason}</dd>
                </div>
              )}
              {appointment.internalNotes && (
                <div className="col-span-2">
                  <dt className="text-text-secondary">Internal notes</dt>
                  <dd className="text-text-primary">{appointment.internalNotes}</dd>
                </div>
              )}
            </dl>

            <div>
              <p className="mb-1.5 text-xs font-medium text-text-secondary">Update status</p>
              <StatusActionBar appointment={appointment} />
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {canReschedule && (
                <Button type="button" variant="outline" onClick={() => setMode('reschedule')}>
                  Reschedule
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={form.handleSubmit(submitReschedule)} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Date" htmlFor="reschedule-date" required error={form.formState.errors.date?.message}>
                <Input id="reschedule-date" type="date" {...form.register('date')} />
              </Field>
              <Field
                label="Start time"
                htmlFor="reschedule-start"
                required
                error={form.formState.errors.windowStart?.message}
              >
                <Input id="reschedule-start" type="time" {...form.register('windowStart')} />
              </Field>
              <Field
                label="End time"
                htmlFor="reschedule-end"
                required
                error={form.formState.errors.windowEnd?.message}
              >
                <Input id="reschedule-end" type="time" {...form.register('windowEnd')} />
              </Field>
            </div>

            {availableSlots.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-secondary">Suggested slots</p>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={`${slot.windowStart}-${slot.windowEnd}`}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:border-primary hover:text-primary"
                      onClick={() => {
                        form.setValue('windowStart', slot.windowStart, { shouldValidate: true });
                        form.setValue('windowEnd', slot.windowEnd, { shouldValidate: true });
                      }}
                    >
                      {formatTimeLabel(slot.windowStart)}–{formatTimeLabel(slot.windowEnd)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field
              label="Reason for reschedule"
              htmlFor="reschedule-reason"
              required
              error={form.formState.errors.reason?.message}
            >
              <Textarea id="reschedule-reason" rows={2} {...form.register('reason')} />
            </Field>

            {conflict && (
              <div className="rounded border border-danger/30 bg-danger/5 p-3 text-sm" role="alert">
                <p className="font-medium text-danger">This slot is already booked</p>
                {canOverride ? (
                  <label className="mt-2 flex items-center gap-2 text-sm text-text-primary">
                    <input type="checkbox" className="h-4 w-4 rounded border-border" {...form.register('overrideCapacity')} />
                    Override and book this slot anyway
                  </label>
                ) : (
                  <p className="mt-1 text-text-secondary">This slot is full. Choose a different time.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={() => setMode('view')}>
                Back
              </Button>
              <Button
                type="submit"
                loading={form.formState.isSubmitting || rescheduleMutation.isPending}
                disabled={conflict && !canOverride}
              >
                {conflict && canOverride ? 'Reschedule Anyway' : 'Confirm Reschedule'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

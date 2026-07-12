import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAppointmentSchema, type CreateAppointmentInput } from '@clinicos/validation';
import { APPOINTMENT_TYPES, PERMISSIONS } from '@clinicos/types';
import {
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '../../../components/ui';
import { usePermission } from '../../../hooks/use-permission';
import { apiErrorMessage } from '../../../lib/api-client';
import { apiErrorCode, useAvailableSlotsQuery, useCreateAppointmentMutation, useDoctorsQuery } from '../api';
import { APPOINTMENT_TYPE_LABEL } from '../status';
import { formatTimeLabel, subtractMinutesFromTime } from '../lib/time';
import { PatientPicker, type PickedPatient } from './PatientPicker';

export interface NewAppointmentPrefill {
  date?: string;
  windowStart?: string;
  windowEnd?: string;
  doctorId?: string;
}

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: NewAppointmentPrefill;
}

const EMPTY_VALUES: CreateAppointmentInput = {
  patientId: '',
  doctorId: '',
  date: '',
  windowStart: '',
  windowEnd: '',
  type: 'new',
  reason: undefined,
  internalNotes: undefined,
  patientNotes: undefined,
  overrideCapacity: false,
};

export function NewAppointmentDialog({ open, onOpenChange, prefill }: NewAppointmentDialogProps) {
  const { has } = usePermission();
  const [selectedPatient, setSelectedPatient] = useState<PickedPatient | null>(null);
  const [conflict, setConflict] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: EMPTY_VALUES,
  });

  const doctorsQuery = useDoctorsQuery();
  const createMutation = useCreateAppointmentMutation();

  useEffect(() => {
    if (!open) return;
    reset({
      ...EMPTY_VALUES,
      date: prefill?.date ?? '',
      windowStart: prefill?.windowStart ?? '',
      windowEnd: prefill?.windowEnd ?? '',
      doctorId: prefill?.doctorId ?? '',
    });
    setSelectedPatient(null);
    setConflict(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  const doctorId = watch('doctorId');
  const date = watch('date');
  const windowStart = watch('windowStart');
  const slotsQuery = useAvailableSlotsQuery({ doctorId, date });

  useEffect(() => {
    setConflict(false);
  }, [doctorId, date, windowStart]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Appointment booked');
      onOpenChange(false);
    } catch (error) {
      const code = apiErrorCode(error);
      if (code === 'DOUBLE_BOOKING' || code === 'CAPACITY_EXCEEDED') {
        setConflict(true);
      } else {
        toast.error('Could not book appointment', apiErrorMessage(error));
      }
    }
  });

  const canOverride = has(PERMISSIONS.APPOINTMENT_OVERRIDE);
  const availableSlots = slotsQuery.data?.filter((slot) => slot.available) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New Appointment" description="Book a windowed appointment slot for a patient.">
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <Field label="Patient" htmlFor="appointment-patient" required error={errors.patientId?.message}>
            <PatientPicker
              value={selectedPatient}
              invalid={Boolean(errors.patientId)}
              onChange={(patient) => {
                setSelectedPatient(patient);
                setValue('patientId', patient?.id ?? '', { shouldValidate: true });
              }}
            />
          </Field>

          <Field label="Doctor" htmlFor="appointment-doctor" required error={errors.doctorId?.message}>
            {doctorsQuery.isError ? (
              <Input
                id="appointment-doctor"
                placeholder="Doctor directory unavailable — enter the doctor's staff ID"
                invalid={Boolean(errors.doctorId)}
                {...register('doctorId')}
              />
            ) : (
              <Controller
                control={control}
                name="doctorId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="appointment-doctor" aria-invalid={Boolean(errors.doctorId) || undefined}>
                      <SelectValue placeholder={doctorsQuery.isLoading ? 'Loading doctors…' : 'Select a doctor'} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctorsQuery.data?.map((doctor) => (
                        <SelectItem key={doctor.id} value={doctor.userId}>
                          Dr. {doctor.name}
                          {doctor.specialization ? ` · ${doctor.specialization}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Date" htmlFor="appointment-date" required error={errors.date?.message}>
              <Input id="appointment-date" type="date" invalid={Boolean(errors.date)} {...register('date')} />
            </Field>
            <Field label="Start time" htmlFor="appointment-start" required error={errors.windowStart?.message}>
              <Input
                id="appointment-start"
                type="time"
                invalid={Boolean(errors.windowStart)}
                {...register('windowStart')}
              />
            </Field>
            <Field label="End time" htmlFor="appointment-end" required error={errors.windowEnd?.message}>
              <Input
                id="appointment-end"
                type="time"
                invalid={Boolean(errors.windowEnd)}
                {...register('windowEnd')}
              />
            </Field>
          </div>

          {windowStart && (
            <p className="text-xs text-text-secondary">
              Recommended patient arrival:{' '}
              <span className="font-medium text-text-primary">
                {formatTimeLabel(subtractMinutesFromTime(windowStart, 10))}
              </span>{' '}
              — about 10 minutes before the window, not an exact consultation time.
            </p>
          )}

          {doctorId && date && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-secondary">Suggested slots</p>
              {slotsQuery.isLoading && <p className="text-xs text-text-secondary">Loading availability…</p>}
              {slotsQuery.isError && (
                <p className="text-xs text-text-secondary">Availability unavailable — enter a time manually.</p>
              )}
              {!slotsQuery.isLoading && !slotsQuery.isError && (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.length === 0 && (
                    <p className="text-xs text-text-secondary">No open slots for this date.</p>
                  )}
                  {availableSlots.map((slot) => (
                    <button
                      key={`${slot.windowStart}-${slot.windowEnd}`}
                      type="button"
                      className="rounded-full border border-border px-3 py-1 text-xs text-text-primary hover:border-primary hover:text-primary"
                      onClick={() => {
                        setValue('windowStart', slot.windowStart, { shouldValidate: true });
                        setValue('windowEnd', slot.windowEnd, { shouldValidate: true });
                      }}
                    >
                      {formatTimeLabel(slot.windowStart)}–{formatTimeLabel(slot.windowEnd)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Field label="Appointment type" htmlFor="appointment-type" required>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="appointment-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {APPOINTMENT_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Reason for visit"
            htmlFor="appointment-reason"
            hint="Optional — shown to reception and the doctor."
            error={errors.reason?.message}
          >
            <Textarea id="appointment-reason" rows={2} invalid={Boolean(errors.reason)} {...register('reason')} />
          </Field>

          {conflict && (
            <div className="rounded border border-danger/30 bg-danger/5 p-3 text-sm" role="alert">
              <p className="font-medium text-danger">This slot is already booked</p>
              {canOverride ? (
                <>
                  <p className="mt-1 text-text-secondary">
                    You can override capacity and book anyway. This will be recorded on the appointment.
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-sm text-text-primary">
                    <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('overrideCapacity')} />
                    Override and book this slot anyway
                  </label>
                </>
              ) : (
                <p className="mt-1 text-text-secondary">
                  This slot is full. Choose a different time, or ask someone with override permission to book it.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting || createMutation.isPending}
              disabled={conflict && !canOverride}
            >
              {conflict && canOverride ? 'Book Anyway' : 'Book Appointment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

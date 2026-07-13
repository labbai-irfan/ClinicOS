import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { PageHeader } from '../../../components/ui/PageHeader';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client-patient';
import {
  useBookAppointmentMutation,
  usePatientAvailableSlotsQuery,
  usePatientBranchesQuery,
  usePatientDoctorsQuery,
} from '../api';
import { TimeSlotPicker } from '../components/TimeSlotPicker';

const bookAppointmentSchema = z.object({
  branchId: z.string().min(1, 'Please select a branch'),
  doctorId: z.string().min(1, 'Please select a doctor'),
  date: z.string().min(1, 'Please select a date'),
  windowStart: z.string().min(1, 'Please select a time'),
  notes: z.string().optional(),
});

type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export default function BookAppointmentPage() {
  const navigate = useNavigate();
  const bookAppointment = useBookAppointmentMutation();
  const branchesQuery = usePatientBranchesQuery();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<BookAppointmentInput>({
    resolver: zodResolver(bookAppointmentSchema),
  });

  const selectedBranch = watch('branchId');
  const selectedDoctor = watch('doctorId');
  const selectedDate = watch('date');
  const selectedSlot = watch('windowStart');

  const doctorsQuery = usePatientDoctorsQuery(selectedBranch);
  const slotsQuery = usePatientAvailableSlotsQuery(selectedDoctor, selectedDate, selectedBranch);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const slot = (slotsQuery.data ?? []).find((s) => s.windowStart === values.windowStart);
      const startTime = slot ? `${values.date}T${slot.windowStart}:00` : values.windowStart;
      const endTime = slot ? `${values.date}T${slot.windowEnd}:00` : values.windowStart;

      await bookAppointment.mutateAsync({
        doctorId: values.doctorId,
        branchId: values.branchId,
        startTime,
        endTime,
        reason: values.notes,
      });

      toast.success('Appointment booked successfully');
      reset();
      navigate('/appointments');
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not book appointment') });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book an Appointment"
        description="Find available times with your preferred doctor"
      />

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Branch" htmlFor="branch" required error={errors.branchId?.message}>
              <select
                id="branch"
                {...register('branchId', {
                  onChange: () => {
                    setValue('doctorId', '');
                    setValue('windowStart', '');
                  },
                })}
                disabled={branchesQuery.isLoading}
                className="flex h-11 min-h-[44px] w-full items-center rounded border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a branch</option>
                {(branchesQuery.data ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Doctor" htmlFor="doctor" required error={errors.doctorId?.message}>
              <select
                id="doctor"
                {...register('doctorId', {
                  onChange: () => setValue('windowStart', ''),
                })}
                disabled={!selectedBranch || doctorsQuery.isLoading}
                className="flex h-11 min-h-[44px] w-full items-center rounded border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a doctor</option>
                {(doctorsQuery.data ?? []).map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Preferred Date" htmlFor="date" required error={errors.date?.message}>
              <Input
                id="date"
                type="date"
                {...register('date', {
                  onChange: () => setValue('windowStart', ''),
                })}
                disabled={!selectedDoctor}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </Field>
          </div>

          {selectedDoctor && selectedDate && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-text-primary">
                Available Time Slots
              </label>
              <TimeSlotPicker
                slots={slotsQuery.data ?? []}
                selectedSlot={selectedSlot}
                onSelectSlot={(windowStart) => setValue('windowStart', windowStart, { shouldValidate: true })}
                isLoading={slotsQuery.isLoading}
              />
              {errors.windowStart?.message && (
                <p className="text-sm text-danger">{errors.windowStart.message}</p>
              )}
            </div>
          )}

          <Field
            label="Additional Notes"
            htmlFor="notes"
            hint="Tell the doctor why you're visiting"
            error={errors.notes?.message}
          >
            <Input
              id="notes"
              placeholder="Any concerns or symptoms to mention?"
              {...register('notes')}
            />
          </Field>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-danger">
              {errors.root.message}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/appointments')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedDoctor || !selectedDate}
              loading={isSubmitting || bookAppointment.isPending}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Book Appointment
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

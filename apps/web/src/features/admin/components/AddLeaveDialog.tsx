import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarOff } from 'lucide-react';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useAddDoctorLeaveMutation } from '../api';

const leaveFormSchema = z
  .object({
    from: z.string().min(1, 'Required'),
    to: z.string().min(1, 'Required'),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.to >= v.from, { message: 'End date must be on or after the start date', path: ['to'] });
type LeaveFormValues = z.infer<typeof leaveFormSchema>;

export function AddLeaveDialog({
  open,
  onClose,
  doctorId,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  doctorId: string;
  branchId?: string;
}) {
  const addLeave = useAddDoctorLeaveMutation();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { from: '', to: '', reason: '' },
  });

  const close = () => {
    reset({ from: '', to: '', reason: '' });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addLeave.mutateAsync({
        doctorId,
        branchId,
        from: values.from,
        to: values.to,
        reason: values.reason || undefined,
      });
      toast.success('Leave added');
      close();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not add leave.') });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent title="Add leave" description="Block this doctor's schedule for a date range.">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" htmlFor="leave-from" required error={errors.from?.message}>
                <Input id="leave-from" type="date" invalid={!!errors.from} {...register('from')} />
              </Field>
              <Field label="To" htmlFor="leave-to" required error={errors.to?.message}>
                <Input id="leave-to" type="date" invalid={!!errors.to} {...register('to')} />
              </Field>
            </div>
            <Field label="Reason" htmlFor="leave-reason" hint="Optional" error={errors.reason?.message}>
              <Textarea id="leave-reason" rows={2} {...register('reason')} />
            </Field>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || addLeave.isPending}>
                <CalendarOff className="h-4 w-4" aria-hidden="true" />
                Add leave
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

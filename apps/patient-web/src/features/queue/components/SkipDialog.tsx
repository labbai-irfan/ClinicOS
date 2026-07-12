import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { queueSkipSchema } from '@clinicos/validation';
import type { QueueEntryDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useSkipMutation, type QueueSkipInput } from '../api';

/** Skip always requires a reason — recorded in the immutable queue history + audit log. */
export function SkipDialog({
  entry,
  onClose,
}: {
  entry: QueueEntryDto | null;
  onClose: () => void;
}) {
  const skip = useSkipMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QueueSkipInput>({ resolver: zodResolver(queueSkipSchema), defaultValues: { reason: '' } });

  const close = () => {
    reset({ reason: '' });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!entry) return;
    try {
      await skip.mutateAsync({ id: entry.id, ...values });
      toast.success('Patient skipped', `Token ${entry.token} was skipped.`);
      close();
    } catch (err) {
      toast.error('Could not skip patient', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={!!entry} onOpenChange={(next) => !next && close()}>
      {entry && (
        <DialogContent
          title={`Skip token ${entry.token}`}
          description="A reason is required — this is recorded in the queue history."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Reason" htmlFor="skip-reason" required error={errors.reason?.message}>
              <Textarea id="skip-reason" invalid={!!errors.reason} {...register('reason')} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Back
              </Button>
              <Button type="submit" variant="danger" loading={isSubmitting || skip.isPending}>
                Skip Patient
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

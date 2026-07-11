import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { callPatientSchema } from '@clinicos/validation';
import type { QueueEntryDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useCallPatientMutation, type QueueCallInput } from '../api';

export function CallPatientDialog({
  entry,
  onClose,
}: {
  entry: QueueEntryDto | null;
  onClose: () => void;
}) {
  const callPatient = useCallPatientMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<QueueCallInput>({ resolver: zodResolver(callPatientSchema) });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!entry) return;
    try {
      await callPatient.mutateAsync({ id: entry.id, ...values });
      toast.success('Patient called', `Token ${entry.token} has been called.`);
      close();
    } catch (err) {
      toast.error('Could not call patient', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={!!entry} onOpenChange={(next) => !next && close()}>
      {entry && (
        <DialogContent
          title={`Call token ${entry.token}`}
          description="Optionally note the room number — this appears on the waiting-room display."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Room" htmlFor="call-room" hint="Optional">
              <Input id="call-room" placeholder="e.g. Room 3" {...register('room')} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || callPatient.isPending}>
                Call Patient
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

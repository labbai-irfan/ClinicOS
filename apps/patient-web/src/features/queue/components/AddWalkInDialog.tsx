import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { objectId, optionalText } from '@clinicos/validation';
import type { AddToQueueInput } from '@clinicos/validation';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useAddToQueueMutation } from '../api';

// Local form-only schema: HTML inputs always yield '' (never undefined), so this keeps
// input/output types symmetric for react-hook-form while still reusing the shared
// `objectId` / `optionalText` primitives from @clinicos/validation. The final payload is
// assembled into the canonical `AddToQueueInput` shape on submit.
const addWalkInFormSchema = z.object({
  patientId: objectId,
  doctorId: z.string().trim().max(24).optional(),
  reasonForVisit: optionalText(300),
  priority: z.number().int().min(0).max(10),
});
type AddWalkInFormValues = z.infer<typeof addWalkInFormSchema>;

export function AddWalkInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addToQueue = useAddToQueueMutation();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddWalkInFormValues>({
    resolver: zodResolver(addWalkInFormSchema),
    defaultValues: { priority: 0 },
  });

  const close = () => {
    reset({ patientId: '', doctorId: '', reasonForVisit: undefined, priority: 0 });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: AddToQueueInput = {
      patientId: values.patientId,
      doctorId: values.doctorId?.trim() ? values.doctorId.trim() : undefined,
      source: 'walk_in',
      reasonForVisit: values.reasonForVisit,
      priority: values.priority,
    };
    try {
      const created = await addToQueue.mutateAsync(payload);
      toast.success('Added to queue', `Token ${created.token} issued.`);
      close();
    } catch (err) {
      toast.error('Could not add to queue', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent
          title="Add walk-in"
          description="Quickly add a walk-in patient to today's queue."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field
              label="Patient ID"
              htmlFor="walkin-patientId"
              required
              hint="Pragmatic fallback: paste the patient's record ID until patient search is wired in here."
              error={errors.patientId?.message}
            >
              <Input id="walkin-patientId" invalid={!!errors.patientId} {...register('patientId')} />
            </Field>
            <Field
              label="Doctor ID"
              htmlFor="walkin-doctorId"
              hint="Optional — leave blank to assign a doctor later"
              error={errors.doctorId?.message}
            >
              <Input id="walkin-doctorId" invalid={!!errors.doctorId} {...register('doctorId')} />
            </Field>
            <Field label="Reason for visit" htmlFor="walkin-reason" hint="Optional">
              <Textarea id="walkin-reason" {...register('reasonForVisit')} />
            </Field>
            <Field label="Priority" htmlFor="walkin-priority" hint="0 = normal, higher = more urgent (0-10)">
              <Input
                id="walkin-priority"
                type="number"
                min={0}
                max={10}
                {...register('priority', {
                  setValueAs: (v) => (v === '' || v === undefined ? 0 : Number(v)),
                })}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || addToQueue.isPending}>
                Add to Queue
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

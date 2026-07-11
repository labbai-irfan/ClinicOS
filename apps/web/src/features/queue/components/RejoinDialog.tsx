import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { queueRejoinSchema } from '@clinicos/validation';
import { REJOIN_POLICIES } from '@clinicos/types';
import type { QueueEntryDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useRejoinMutation, type QueueRejoinInput } from '../api';
import { REJOIN_POLICY_LABELS } from '../queue-labels';

// Radix Select items must have a non-empty value; this sentinel represents "no policy
// override selected" and is translated to `undefined` before it ever reaches the form state.
const DEFAULT_POLICY_VALUE = '__clinic_default__';

export function RejoinDialog({
  entry,
  canOverride,
  onClose,
}: {
  entry: QueueEntryDto | null;
  canOverride: boolean;
  onClose: () => void;
}) {
  const rejoin = useRejoinMutation();
  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QueueRejoinInput>({
    resolver: zodResolver(queueRejoinSchema),
    defaultValues: { reason: '' },
  });

  const policy = watch('policy');
  // "manual" bypasses the clinic's configured rejoin policy — restricted to queue.override.
  const policyOptions = REJOIN_POLICIES.filter((p) => p !== 'manual' || canOverride);

  const close = () => {
    reset({ reason: '', policy: undefined, manualPosition: undefined });
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!entry) return;
    try {
      await rejoin.mutateAsync({ id: entry.id, ...values });
      toast.success('Patient rejoined', `Token ${entry.token} is back in the queue.`);
      close();
    } catch (err) {
      toast.error('Could not rejoin patient', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={!!entry} onOpenChange={(next) => !next && close()}>
      {entry && (
        <DialogContent
          title={`Rejoin token ${entry.token}`}
          description="Choose when this patient should rejoin the queue. A reason is required."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Rejoin policy" htmlFor="rejoin-policy" hint="Leave unset to use the clinic default">
              <Controller
                control={control}
                name="policy"
                render={({ field }) => (
                  <Select
                    value={field.value ?? DEFAULT_POLICY_VALUE}
                    onValueChange={(v) => field.onChange(v === DEFAULT_POLICY_VALUE ? undefined : v)}
                  >
                    <SelectTrigger id="rejoin-policy">
                      <SelectValue placeholder="Clinic default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEFAULT_POLICY_VALUE}>Use clinic default</SelectItem>
                      {policyOptions.map((p) => (
                        <SelectItem key={p} value={p}>
                          {REJOIN_POLICY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {policy === 'manual' && (
              <Field
                label="Manual position"
                htmlFor="rejoin-manual-position"
                hint="Position in the active queue (0 = next)"
              >
                <Input
                  id="rejoin-manual-position"
                  type="number"
                  min={0}
                  {...register('manualPosition', {
                    setValueAs: (v) => (v === '' || v === undefined ? undefined : Number(v)),
                  })}
                />
              </Field>
            )}

            <Field label="Reason" htmlFor="rejoin-reason" required error={errors.reason?.message}>
              <Textarea id="rejoin-reason" invalid={!!errors.reason} {...register('reason')} />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Back
              </Button>
              <Button type="submit" loading={isSubmitting || rejoin.isPending}>
                Rejoin Patient
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

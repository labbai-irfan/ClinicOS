import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { emergencyReferralSchema } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Dialog, DialogContent, DialogTrigger } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useReferralMutation, type ReferralInput } from '../api';

export function ReferralDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const referral = useReferralMutation(caseId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReferralInput>({
    resolver: zodResolver(emergencyReferralSchema),
    defaultValues: { facilityName: '', reason: '', notes: '', transportMode: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await referral.mutateAsync(values);
      toast.success('Referral recorded', `Referred to ${values.facilityName}.`);
      reset({ facilityName: '', reason: '', notes: '', transportMode: '' });
      setOpen(false);
    } catch (err) {
      toast.error('Could not record referral', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Send className="h-4 w-4" aria-hidden="true" />
          Referral
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Refer this case"
        description="Record where the patient is being referred or transferred."
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            label="Facility name"
            htmlFor="referral-facility"
            required
            error={errors.facilityName?.message}
          >
            <Input id="referral-facility" invalid={!!errors.facilityName} {...register('facilityName')} />
          </Field>
          <Field label="Reason" htmlFor="referral-reason" required error={errors.reason?.message}>
            <Textarea id="referral-reason" invalid={!!errors.reason} rows={3} {...register('reason')} />
          </Field>
          <Field
            label="Transport mode"
            htmlFor="referral-transport"
            hint="Optional"
            error={errors.transportMode?.message}
          >
            <Input id="referral-transport" {...register('transportMode')} />
          </Field>
          <Field label="Notes" htmlFor="referral-notes" hint="Optional" error={errors.notes?.message}>
            <Textarea id="referral-notes" rows={3} {...register('notes')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || referral.isPending}>
              Save referral
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

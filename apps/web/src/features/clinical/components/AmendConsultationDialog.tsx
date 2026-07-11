import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { ConsultationDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useAmendConsultationMutation } from '../api';
import { ChipList } from './ChipList';

interface AmendFormValues {
  reason: string;
  symptoms: string;
  examinationFindings: string;
  clinicalNotes: string;
  diagnosis: string[];
  treatmentPlan: string;
  advice: string;
  testsOrdered: string[];
  followUpDate: string;
}

function defaultsFrom(consultation: ConsultationDto): AmendFormValues {
  return {
    reason: '',
    symptoms: consultation.symptoms ?? '',
    examinationFindings: consultation.examinationFindings ?? '',
    clinicalNotes: consultation.clinicalNotes ?? '',
    diagnosis: consultation.diagnosis,
    treatmentPlan: consultation.treatmentPlan ?? '',
    advice: consultation.advice ?? '',
    testsOrdered: consultation.testsOrdered,
    followUpDate: consultation.followUpAt?.slice(0, 10) ?? '',
  };
}

/**
 * The only way to change a finalized ('completed') consultation — the backend rejects
 * direct edits once it is no longer a draft (RECORD_FINALIZED). Every change requires a
 * reason and is recorded as an append-only amendment for the audit trail (spec §22/§37).
 */
export function AmendConsultationDialog({
  consultation,
  open,
  onOpenChange,
}: {
  consultation: ConsultationDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const amend = useAmendConsultationMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AmendFormValues>({ defaultValues: defaultsFrom(consultation) });

  useEffect(() => {
    if (open) reset(defaultsFrom(consultation));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only when the dialog (re)opens
  }, [open]);

  const onSubmit = handleSubmit(async ({ reason, ...changes }) => {
    try {
      await amend.mutateAsync({ id: consultation.id, input: { reason, changes } });
      toast.success('Consultation amended');
      onOpenChange(false);
    } catch (err) {
      toast.error('Could not amend consultation', apiErrorMessage(err));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Amend consultation"
        description="This consultation is finalized. Changes are recorded with your reason for an audit trail."
        className="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Reason for amendment" htmlFor="amend-reason" required error={errors.reason?.message}>
            <Textarea
              id="amend-reason"
              rows={2}
              invalid={!!errors.reason}
              {...register('reason', { required: 'A reason is required' })}
            />
          </Field>
          <Field label="Symptoms" htmlFor="amend-symptoms">
            <Textarea id="amend-symptoms" rows={2} {...register('symptoms')} />
          </Field>
          <Field label="Examination findings" htmlFor="amend-examinationFindings">
            <Textarea id="amend-examinationFindings" rows={2} {...register('examinationFindings')} />
          </Field>
          <Field label="Clinical notes" htmlFor="amend-clinicalNotes">
            <Textarea id="amend-clinicalNotes" rows={2} {...register('clinicalNotes')} />
          </Field>
          <Controller
            control={control}
            name="diagnosis"
            render={({ field }) => (
              <ChipList label="Diagnosis" values={field.value ?? []} onChange={field.onChange} maxLength={240} maxItems={20} />
            )}
          />
          <Field label="Treatment plan" htmlFor="amend-treatmentPlan">
            <Textarea id="amend-treatmentPlan" rows={2} {...register('treatmentPlan')} />
          </Field>
          <Field label="Advice" htmlFor="amend-advice">
            <Textarea id="amend-advice" rows={2} {...register('advice')} />
          </Field>
          <Controller
            control={control}
            name="testsOrdered"
            render={({ field }) => (
              <ChipList label="Tests ordered" values={field.value ?? []} onChange={field.onChange} maxLength={200} maxItems={30} />
            )}
          />
          <Field label="Follow-up date" htmlFor="amend-followUpDate">
            <Input id="amend-followUpDate" type="date" {...register('followUpDate')} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting || amend.isPending}>
              Save amendment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

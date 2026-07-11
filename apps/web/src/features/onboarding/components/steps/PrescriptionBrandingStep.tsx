import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Textarea } from '../../../../components/ui/Input';
import { Field } from '../../../../components/ui/Field';
import { apiErrorMessage } from '../../../../lib/api-client';
import { prescriptionBrandingSchema, type PrescriptionBrandingInput } from '../../schemas';
import { useUpdateClinicMutation, type ClinicRecord } from '../../api';
import { StepFooter } from '../StepFooter';

interface PrescriptionBrandingStepProps {
  clinic: ClinicRecord | undefined;
  onBack: () => void;
  onComplete: (patch: PrescriptionBrandingInput) => void;
}

export function PrescriptionBrandingStep({ clinic, onBack, onComplete }: PrescriptionBrandingStepProps) {
  const updateClinic = useUpdateClinicMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PrescriptionBrandingInput>({
    resolver: zodResolver(prescriptionBrandingSchema),
    values: clinic
      ? {
          prescriptionHeader: clinic.prescriptionHeader,
          prescriptionFooter: clinic.prescriptionFooter,
        }
      : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateClinic.mutateAsync(values);
      onComplete(values);
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save prescription branding.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Prescription branding</CardTitle>
          <CardDescription>Shown at the top and bottom of every printed prescription.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Header"
          htmlFor="rx-header"
          hint="e.g. clinic name, address and registration number"
          error={errors.prescriptionHeader?.message}
        >
          <Textarea id="rx-header" rows={3} invalid={!!errors.prescriptionHeader} {...register('prescriptionHeader')} />
        </Field>
        <Field
          label="Footer"
          htmlFor="rx-footer"
          hint="e.g. disclaimer or follow-up instructions"
          error={errors.prescriptionFooter?.message}
        >
          <Textarea id="rx-footer" rows={3} invalid={!!errors.prescriptionFooter} {...register('prescriptionFooter')} />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} loading={isSubmitting || updateClinic.isPending} />
      </div>
    </form>
  );
}

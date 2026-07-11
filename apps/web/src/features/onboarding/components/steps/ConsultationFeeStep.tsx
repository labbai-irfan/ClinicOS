import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Field } from '../../../../components/ui/Field';
import { apiErrorMessage } from '../../../../lib/api-client';
import { useUpdateClinicSettingsMutation } from '../../api';
import { StepFooter } from '../StepFooter';

/** Rupee amount as typed by the user; converted to integer paise on submit. */
const feeFormSchema = z.object({
  feeRupees: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0).max(1_000_000),
});
type FeeFormInput = z.infer<typeof feeFormSchema>;

interface ConsultationFeeStepProps {
  onBack: () => void;
  onComplete: (patch: { consultationFeePaise: number }) => void;
}

export function ConsultationFeeStep({ onBack, onComplete }: ConsultationFeeStepProps) {
  const updateSettings = useUpdateClinicSettingsMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FeeFormInput>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: { feeRupees: 500 },
  });

  const onSubmit = handleSubmit(async (values) => {
    const defaultConsultationFeePaise = Math.round(values.feeRupees * 100);
    try {
      await updateSettings.mutateAsync({ defaultConsultationFeePaise });
      onComplete({ consultationFeePaise: defaultConsultationFeePaise });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save the consultation fee.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Consultation fees</CardTitle>
          <CardDescription>
            The default fee charged for a consultation. You can set a different fee per doctor later.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Default consultation fee (INR)"
          htmlFor="fee-rupees"
          required
          error={errors.feeRupees?.message}
        >
          <Input
            id="fee-rupees"
            type="number"
            min={0}
            step="1"
            inputMode="decimal"
            invalid={!!errors.feeRupees}
            {...register('feeRupees')}
          />
        </Field>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} loading={isSubmitting || updateSettings.isPending} />
      </div>
    </form>
  );
}

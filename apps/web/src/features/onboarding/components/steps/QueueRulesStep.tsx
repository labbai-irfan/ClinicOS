import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { REJOIN_POLICIES, type RejoinPolicy } from '@clinicos/types';
import { DEFAULTS } from '@clinicos/config';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Field } from '../../../../components/ui/Field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/Select';
import { apiErrorMessage } from '../../../../lib/api-client';
import { queueRulesSchema, type QueueRulesInput } from '../../schemas';
import { useUpdateClinicSettingsMutation } from '../../api';
import { StepFooter } from '../StepFooter';

const REJOIN_POLICY_LABELS: Record<RejoinPolicy, string> = {
  after_next_patient: 'After the next patient',
  after_two_patients: 'After two patients',
  end_of_priority_group: 'End of the priority group',
  manual: 'Manual (staff decides)',
};

interface QueueRulesStepProps {
  onBack: () => void;
  onComplete: (patch: QueueRulesInput) => void;
}

export function QueueRulesStep({ onBack, onComplete }: QueueRulesStepProps) {
  const updateSettings = useUpdateClinicSettingsMutation();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QueueRulesInput>({
    resolver: zodResolver(queueRulesSchema),
    defaultValues: {
      appointmentWindowMinutes: DEFAULTS.APPOINTMENT_WINDOW_MINUTES,
      bufferMinutes: DEFAULTS.APPOINTMENT_BUFFER_MINUTES,
      rejoinPolicy: DEFAULTS.REJOIN_POLICY,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync(values);
      onComplete(values);
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save appointment & queue rules.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Appointment &amp; queue rules</CardTitle>
          <CardDescription>Controls slot length and what happens when a patient steps away.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Appointment window (minutes)"
            htmlFor="window-minutes"
            required
            hint="Length of each booking slot"
            error={errors.appointmentWindowMinutes?.message}
          >
            <Input
              id="window-minutes"
              type="number"
              min={5}
              max={120}
              invalid={!!errors.appointmentWindowMinutes}
              {...register('appointmentWindowMinutes', { valueAsNumber: true })}
            />
          </Field>
          <Field
            label="Buffer between slots (minutes)"
            htmlFor="buffer-minutes"
            required
            error={errors.bufferMinutes?.message}
          >
            <Input
              id="buffer-minutes"
              type="number"
              min={0}
              max={60}
              invalid={!!errors.bufferMinutes}
              {...register('bufferMinutes', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <Field
          label="Rejoin policy"
          htmlFor="rejoin-policy"
          required
          hint="Where a patient rejoins the queue after stepping away"
          error={errors.rejoinPolicy?.message}
        >
          <Controller
            control={control}
            name="rejoinPolicy"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="rejoin-policy">
                  <SelectValue placeholder="Select a policy" />
                </SelectTrigger>
                <SelectContent>
                  {REJOIN_POLICIES.map((policy) => (
                    <SelectItem key={policy} value={policy}>
                      {REJOIN_POLICY_LABELS[policy]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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

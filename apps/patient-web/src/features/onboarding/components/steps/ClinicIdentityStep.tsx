import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { clinicIdentitySchema, type ClinicIdentityInput } from '../../schemas';
import { useUpdateClinicMutation, type ClinicRecord } from '../../api';
import { StepFooter } from '../StepFooter';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Kathmandu',
  'Asia/Colombo',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Bangkok',
  'UTC',
  'Europe/London',
  'America/New_York',
];

interface ClinicIdentityStepProps {
  clinic: ClinicRecord | undefined;
  onComplete: (patch: { identity: ClinicIdentityInput }) => void;
}

export function ClinicIdentityStep({ clinic, onComplete }: ClinicIdentityStepProps) {
  const updateClinic = useUpdateClinicMutation();

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClinicIdentityInput>({
    resolver: zodResolver(clinicIdentitySchema),
    values: clinic
      ? {
          name: clinic.name,
          phone: clinic.phone ?? undefined,
          email: clinic.email ?? undefined,
          timezone: clinic.timezone,
        }
      : undefined,
    defaultValues: { name: '', timezone: 'Asia/Kolkata' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateClinic.mutateAsync(values);
      onComplete({ identity: values });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save clinic details.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Clinic identity</CardTitle>
          <CardDescription>This appears on invoices, prescriptions and patient-facing screens.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Clinic name" htmlFor="clinic-name" required error={errors.name?.message}>
          <Input id="clinic-name" invalid={!!errors.name} {...register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="clinic-phone" error={errors.phone?.message}>
            <Input id="clinic-phone" invalid={!!errors.phone} {...register('phone')} />
          </Field>
          <Field label="Email" htmlFor="clinic-email" error={errors.email?.message}>
            <Input id="clinic-email" type="email" invalid={!!errors.email} {...register('email')} />
          </Field>
        </div>
        <Field
          label="Timezone"
          htmlFor="clinic-timezone"
          required
          hint="Used for appointment scheduling and daily reports"
          error={errors.timezone?.message}
        >
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="clinic-timezone">
                  <SelectValue placeholder="Select a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
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
        <StepFooter loading={isSubmitting || updateClinic.isPending} continueLabel="Continue" />
      </div>
    </form>
  );
}

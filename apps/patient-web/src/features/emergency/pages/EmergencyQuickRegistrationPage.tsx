import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Info, Siren } from 'lucide-react';
import { ARRIVAL_MODES, GENDERS } from '@clinicos/types';
import { createEmergencySchema } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardContent } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useCreateEmergencyMutation, type CreateEmergencyInput } from '../api';
import { ARRIVAL_MODE_LABELS, GENDER_LABELS } from '../lib/status-meta';

/** Quick emergency entry (spec §18) — must work even for a completely unknown patient. */
export default function EmergencyQuickRegistrationPage() {
  const navigate = useNavigate();
  const createEmergency = useCreateEmergencyMutation();

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmergencyInput>({
    resolver: zodResolver(createEmergencySchema),
    defaultValues: {
      name: '',
      approximateAge: undefined,
      gender: 'unknown',
      arrivalMode: 'walk_in',
      mainConcern: '',
      mobile: '',
      address: '',
      emergencyContact: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const dto = await createEmergency.mutateAsync(values);
      toast.success('Emergency case opened', `${dto.caseCode} — proceed to triage.`);
      navigate(`/emergency/${dto.id}`, { replace: true });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not open the emergency case.') });
    }
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Emergency Entry"
        description="Register an arriving patient in seconds — identity can be added later."
      />

      <div className="mb-5 flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-info">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p>
          This patient can be registered with the minimum possible information. Only the main
          concern is required — name, contact details, and everything else can be filled in or
          corrected once the situation is stable.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Patient name"
                htmlFor="name"
                hint="If known"
                error={errors.name?.message}
              >
                <Input id="name" invalid={!!errors.name} {...register('name')} />
              </Field>
              <Field
                label="Approximate age"
                htmlFor="approximateAge"
                hint="Optional"
                error={errors.approximateAge?.message}
              >
                <Input
                  id="approximateAge"
                  type="number"
                  min={0}
                  max={130}
                  inputMode="numeric"
                  invalid={!!errors.approximateAge}
                  {...register('approximateAge', {
                    setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
                  })}
                />
              </Field>

              <Field label="Gender" htmlFor="gender" error={errors.gender?.message}>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="gender" aria-label="Gender">
                        <SelectValue placeholder="Unknown" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {GENDER_LABELS[g]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field label="Arrival mode" htmlFor="arrivalMode" error={errors.arrivalMode?.message}>
                <Controller
                  control={control}
                  name="arrivalMode"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="arrivalMode" aria-label="Arrival mode">
                        <SelectValue placeholder="Walk-in" />
                      </SelectTrigger>
                      <SelectContent>
                        {ARRIVAL_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {ARRIVAL_MODE_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field
              label="Main concern"
              htmlFor="mainConcern"
              required
              hint="The one thing we truly need to know right now"
              error={errors.mainConcern?.message}
            >
              <Textarea
                id="mainConcern"
                invalid={!!errors.mainConcern}
                rows={3}
                {...register('mainConcern')}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile number" htmlFor="mobile" hint="Optional" error={errors.mobile?.message}>
                <Input
                  id="mobile"
                  type="tel"
                  invalid={!!errors.mobile}
                  {...register('mobile', {
                    setValueAs: (v: string) => (v?.trim() === '' ? undefined : v),
                  })}
                />
              </Field>
              <Field
                label="Emergency contact"
                htmlFor="emergencyContact"
                hint="Optional — name/phone of someone to reach"
                error={errors.emergencyContact?.message}
              >
                <Input
                  id="emergencyContact"
                  invalid={!!errors.emergencyContact}
                  {...register('emergencyContact')}
                />
              </Field>
            </div>

            <Field label="Address" htmlFor="address" hint="Optional" error={errors.address?.message}>
              <Textarea id="address" invalid={!!errors.address} rows={2} {...register('address')} />
            </Field>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <Button type="submit" loading={isSubmitting || createEmergency.isPending} className="w-full sm:w-auto">
              <Siren className="h-4 w-4" aria-hidden="true" />
              Open emergency case
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

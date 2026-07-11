import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Hourglass, UserRound } from 'lucide-react';
import { quickRegisterPatientSchema, type QuickRegisterPatientInput } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { Card, CardContent } from '../../../components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { apiErrorMessage } from '../../../lib/api-client';
import { toast } from '../../../components/ui/Toast';
import { useCheckDuplicatesQuery, useCreatePatientMutation } from '../api';
import { useDebouncedValue } from '../hooks';
import { DuplicateWarningBanner } from '../components/DuplicateWarningBanner';

type DobMode = 'dob' | 'age';

export default function PatientRegistrationPage() {
  const navigate = useNavigate();
  const createPatient = useCreatePatientMutation();

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuickRegisterPatientInput>({
    resolver: zodResolver(quickRegisterPatientSchema),
    defaultValues: { fullName: '', isTemporary: false },
  });

  const [fullName, mobile, dateOfBirth, isTemporary] = useWatch({
    control,
    name: ['fullName', 'mobile', 'dateOfBirth', 'isTemporary'],
  });
  const [dobMode, setDobModeState] = useState<DobMode>('dob');

  function setDobMode(mode: DobMode) {
    setDobModeState(mode);
    if (mode === 'dob') {
      setValue('approximateAge', undefined);
    } else {
      setValue('dateOfBirth', undefined);
    }
  }

  useEffect(() => {
    if (isTemporary) {
      setValue('dateOfBirth', undefined);
      setValue('approximateAge', undefined);
    }
  }, [isTemporary, setValue]);

  // Only run the duplicate lookup once there is enough signal to make it meaningful
  // (spec §12): an in-progress mobile number, or a name plus a date of birth.
  const duplicateCheckInput = useMemo(
    () => ({
      fullName: fullName?.trim() || undefined,
      mobile: mobile?.trim() || undefined,
      dateOfBirth: dateOfBirth || undefined,
    }),
    [fullName, mobile, dateOfBirth],
  );
  const debouncedCheck = useDebouncedValue(duplicateCheckInput, 400);
  const canCheckDuplicates =
    Boolean(debouncedCheck.mobile && debouncedCheck.mobile.length >= 7) ||
    Boolean(debouncedCheck.fullName && debouncedCheck.fullName.length >= 3 && debouncedCheck.dateOfBirth);

  const { data: duplicates } = useCheckDuplicatesQuery(debouncedCheck, canCheckDuplicates);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const { patient, duplicateWarnings } = await createPatient.mutateAsync(values);
      toast.success(
        'Patient registered',
        duplicateWarnings.length > 0
          ? 'Possible duplicates were noted on the patient record for review.'
          : undefined,
      );
      navigate(`/patients/${patient.id}`);
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not register the patient.') });
    }
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New Registration" description="Quick registration — optimized for the front desk." />

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Card>
          <CardContent className="space-y-5 pt-5">
            <Field label="Full name" htmlFor="fullName" required error={errors.fullName?.message}>
              <Input
                id="fullName"
                autoFocus
                autoComplete="off"
                invalid={!!errors.fullName}
                {...register('fullName')}
              />
            </Field>

            <Field label="Gender" htmlFor="gender" required error={errors.gender?.message}>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="gender" aria-invalid={!!errors.gender}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-border px-3 text-sm text-text-primary">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border"
                {...register('isTemporary')}
              />
              Temporary / unidentified patient (no name or age confirmed yet)
            </label>

            {!isTemporary && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    Date of birth or approximate age
                    <span className="text-danger ml-0.5" aria-hidden="true">
                      *
                    </span>
                  </span>
                  <div className="flex gap-1 rounded border border-border p-0.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={dobMode === 'dob' ? 'primary' : 'ghost'}
                      onClick={() => setDobMode('dob')}
                    >
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      Date of birth
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={dobMode === 'age' ? 'primary' : 'ghost'}
                      onClick={() => setDobMode('age')}
                    >
                      <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
                      Approx. age
                    </Button>
                  </div>
                </div>

                {dobMode === 'dob' ? (
                  <Input
                    type="date"
                    aria-label="Date of birth"
                    max={new Date().toISOString().slice(0, 10)}
                    invalid={!!errors.dateOfBirth}
                    {...register('dateOfBirth', {
                      setValueAs: (v: string) => (v === '' ? undefined : v),
                    })}
                  />
                ) : (
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={130}
                    aria-label="Approximate age in years"
                    placeholder="Age in years"
                    invalid={!!errors.approximateAge}
                    {...register('approximateAge', {
                      setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                    })}
                  />
                )}
                {(errors.dateOfBirth?.message || errors.approximateAge?.message) && (
                  <p role="alert" className="text-xs text-danger">
                    {errors.dateOfBirth?.message || errors.approximateAge?.message}
                  </p>
                )}
              </div>
            )}

            <Field
              label="Mobile"
              htmlFor="mobile"
              hint="Optional — helps prevent duplicate records and enables reminders"
              error={errors.mobile?.message}
            >
              <Input
                id="mobile"
                type="tel"
                inputMode="tel"
                invalid={!!errors.mobile}
                {...register('mobile', {
                  setValueAs: (v: string) => (v === '' ? undefined : v),
                })}
              />
            </Field>

            <Field label="Reason for visit" htmlFor="reasonForVisit" error={errors.reasonForVisit?.message}>
              <Textarea id="reasonForVisit" rows={2} {...register('reasonForVisit')} />
            </Field>
          </CardContent>
        </Card>

        {canCheckDuplicates && duplicates && duplicates.length > 0 && (
          <DuplicateWarningBanner candidates={duplicates} />
        )}

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            loading={isSubmitting || createPatient.isPending}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Register patient
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={() => navigate('/patients')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

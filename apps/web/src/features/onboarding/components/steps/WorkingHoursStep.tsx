import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { WEEKDAYS, type Weekday } from '@clinicos/types';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { apiErrorMessage } from '../../../../lib/api-client';
import { workingHoursFormSchema, type WorkingHoursFormInput } from '../../schemas';
import { useUpdateBranchMutation } from '../../api';
import { StepFooter } from '../StepFooter';

const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DEFAULT_WORKING_HOURS: WorkingHoursFormInput['workingHours'] = WEEKDAYS.map((day) => ({
  day,
  open: '09:00',
  close: '18:00',
  closed: day === 'sunday',
}));

interface WorkingHoursStepProps {
  branchId: string | null;
  onBack: () => void;
  onComplete: (patch: { workingHours: WorkingHoursFormInput['workingHours'] }) => void;
}

export function WorkingHoursStep({ branchId, onBack, onComplete }: WorkingHoursStepProps) {
  const updateBranch = useUpdateBranchMutation();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WorkingHoursFormInput>({
    resolver: zodResolver(workingHoursFormSchema),
    defaultValues: { workingHours: DEFAULT_WORKING_HOURS },
  });
  const rows = watch('workingHours');

  if (!branchId) {
    return (
      <div className="p-4 sm:p-5">
        <ErrorState
          title="No branch found"
          description="Your clinic's default branch could not be found. Please sign out and sign in again, or contact support."
        />
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateBranch.mutateAsync({ branchId, input: { workingHours: values.workingHours } });
      onComplete({ workingHours: values.workingHours });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save working hours.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Working days &amp; hours</CardTitle>
          <CardDescription>Set the hours patients can book or walk in.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-2 sm:grid-cols-[140px_1fr_1fr_auto]">
          <span className="text-xs font-medium uppercase text-text-secondary">Day</span>
          <span className="text-xs font-medium uppercase text-text-secondary">Opens</span>
          <span className="text-xs font-medium uppercase text-text-secondary">Closes</span>
          <span className="text-xs font-medium uppercase text-text-secondary">Closed</span>
          {WEEKDAYS.map((day, index) => {
            const isClosed = rows?.[index]?.closed;
            return (
              <div key={day} className="contents">
                <label htmlFor={`wh-open-${day}`} className="text-sm font-medium text-text-primary">
                  {WEEKDAY_LABELS[day]}
                </label>
                <Input
                  id={`wh-open-${day}`}
                  type="time"
                  disabled={isClosed}
                  aria-label={`${WEEKDAY_LABELS[day]} opening time`}
                  {...register(`workingHours.${index}.open`)}
                />
                <Input
                  type="time"
                  disabled={isClosed}
                  aria-label={`${WEEKDAY_LABELS[day]} closing time`}
                  {...register(`workingHours.${index}.close`)}
                />
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border accent-primary"
                    aria-label={`${WEEKDAY_LABELS[day]} is closed`}
                    {...register(`workingHours.${index}.closed`)}
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} loading={isSubmitting || updateBranch.isPending} />
      </div>
    </form>
  );
}

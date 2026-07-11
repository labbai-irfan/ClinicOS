import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { NotebookPen } from 'lucide-react';
import { emergencyObservationSchema } from '@clinicos/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useObservationMutation, type ObservationInput } from '../api';

/** Quick note capture while a case is under_observation (spec §19) — repeatable, no status change required. */
export function ObservationPanel({ caseId }: { caseId: string }) {
  const observation = useObservationMutation(caseId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ObservationInput>({
    resolver: zodResolver(emergencyObservationSchema),
    defaultValues: { note: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await observation.mutateAsync(values);
      toast.success('Observation note added');
      reset({ note: '' });
    } catch (err) {
      toast.error('Could not add note', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <NotebookPen className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            <CardTitle>Observation notes</CardTitle>
          </div>
          <CardDescription>Log how the patient is doing while under observation.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <Field label="Note" htmlFor="observation-note" required error={errors.note?.message}>
            <Textarea id="observation-note" invalid={!!errors.note} rows={3} {...register('note')} />
          </Field>
          <Button type="submit" size="sm" loading={isSubmitting || observation.isPending}>
            Add note
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

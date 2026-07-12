import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardCheck } from 'lucide-react';
import { EMERGENCY_PRIORITIES } from '@clinicos/types';
import type { EmergencyPriority } from '@clinicos/types';
import { emergencyTriageSchema } from '@clinicos/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
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
import { useTriageMutation, type TriageInput } from '../api';
import { PRIORITY_LABELS } from '../lib/status-meta';

/** Priority is ALWAYS assigned/confirmed by staff — never computed (spec §18). */
export function TriagePanel({
  caseId,
  currentPriority,
}: {
  caseId: string;
  currentPriority: EmergencyPriority;
}) {
  const triage = useTriageMutation(caseId);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TriageInput>({
    resolver: zodResolver(emergencyTriageSchema),
    defaultValues: {
      priority: currentPriority === 'unconfirmed' ? 'standard' : currentPriority,
      notes: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await triage.mutateAsync(values);
      toast.success('Priority confirmed', `Set to ${PRIORITY_LABELS[values.priority]}.`);
      reset({ priority: values.priority, notes: '' });
    } catch (err) {
      toast.error('Could not save triage', apiErrorMessage(err));
    }
  });

  return (
    <Card className="border-warning/40">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-warning" aria-hidden="true" />
            <CardTitle>Triage</CardTitle>
          </div>
          <CardDescription>Confirm the priority before care continues.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Priority" htmlFor="triage-priority" required error={errors.priority?.message}>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="triage-priority" aria-label="Priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMERGENCY_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field
            label="Notes"
            htmlFor="triage-notes"
            hint="Optional — visible in the case timeline"
            error={errors.notes?.message}
          >
            <Textarea id="triage-notes" invalid={!!errors.notes} rows={3} {...register('notes')} />
          </Field>
          <Button type="submit" loading={isSubmitting || triage.isPending}>
            Save triage
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

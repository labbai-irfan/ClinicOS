import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserRound } from 'lucide-react';
import { emergencyAssignSchema } from '@clinicos/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Button } from '../../../components/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { Skeleton } from '../../../components/ui/Skeleton';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useAssignMutation, useStaffDirectoryQuery, type AssignInput } from '../api';

const UNASSIGNED = '__unassigned__';

/** Assign panel (spec §19). Values submitted are User ids (StaffDto.userId), not staff-profile ids. */
export function AssignPanel({
  caseId,
  assignedDoctorId,
  assignedNurseId,
}: {
  caseId: string;
  assignedDoctorId?: string;
  assignedNurseId?: string;
}) {
  const staffQuery = useStaffDirectoryQuery();
  const assign = useAssignMutation(caseId);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AssignInput>({
    resolver: zodResolver(emergencyAssignSchema),
    values: { doctorId: assignedDoctorId, nurseId: assignedNurseId },
  });

  const staff = staffQuery.data ?? [];
  const doctors = staff.filter((s) => s.roleKey === 'doctor' && s.isActive);
  const nurses = staff.filter((s) => s.roleKey === 'nurse' && s.isActive);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await assign.mutateAsync(values);
      toast.success('Assignment saved');
    } catch (err) {
      toast.error('Could not save assignment', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-text-secondary" aria-hidden="true" />
            <CardTitle>Assign staff</CardTitle>
          </div>
          <CardDescription>Attach the doctor and nurse handling this case.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {staffQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : staffQuery.isError ? (
          <p className="text-sm text-text-secondary">
            The staff directory isn't available right now. Assignment can be updated once it's back.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Doctor" htmlFor="assign-doctor">
              <Controller
                control={control}
                name="doctorId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? UNASSIGNED}
                    onValueChange={(v) => field.onChange(v === UNASSIGNED ? undefined : v)}
                  >
                    <SelectTrigger id="assign-doctor" aria-label="Doctor">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {doctors.map((d) => (
                        <SelectItem key={d.userId} value={d.userId}>
                          {d.name}
                          {d.specialization ? ` · ${d.specialization}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Nurse" htmlFor="assign-nurse">
              <Controller
                control={control}
                name="nurseId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? UNASSIGNED}
                    onValueChange={(v) => field.onChange(v === UNASSIGNED ? undefined : v)}
                  >
                    <SelectTrigger id="assign-nurse" aria-label="Nurse">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                      {nurses.map((n) => (
                        <SelectItem key={n.userId} value={n.userId}>
                          {n.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Button type="submit" loading={isSubmitting || assign.isPending}>
              Save assignment
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

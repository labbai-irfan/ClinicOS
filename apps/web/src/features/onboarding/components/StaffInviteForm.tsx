import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { ROLE_KEYS, type RoleKey, type StaffDto } from '@clinicos/types';
import { inviteStaffSchema, type InviteStaffInput } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useInviteStaffMutation } from '../api';

type InvitableRoleKey = Exclude<RoleKey, 'super_admin' | 'patient'>;

const INVITABLE_ROLES = ROLE_KEYS.filter(
  (role): role is InvitableRoleKey => role !== 'super_admin' && role !== 'patient',
);

const ROLE_LABELS: Record<string, string> = {
  clinic_owner: 'Clinic owner',
  clinic_admin: 'Clinic admin',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist',
};

const EMPTY_INVITE_DEFAULTS = {
  name: '',
  email: '',
  phone: '',
  specialization: '',
  qualification: '',
  registrationNumber: '',
};

interface StaffInviteFormProps {
  /** Fix the role for every invite sent from this form (used for step 4: "Add doctors"). */
  fixedRoleKey?: InvitableRoleKey;
  branchId: string | null;
  onInvited?: (staff: StaffDto) => void;
}

/** Mini invite form reused by "Add doctors" (step 4, role fixed) and "Invite staff" (step 8, any role). */
export function StaffInviteForm({ fixedRoleKey, branchId, onInvited }: StaffInviteFormProps) {
  const [invited, setInvited] = useState<StaffDto[]>([]);
  const inviteStaff = useInviteStaffMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteStaffInput>({
    resolver: zodResolver(inviteStaffSchema),
    defaultValues: {
      ...EMPTY_INVITE_DEFAULTS,
      roleKey: fixedRoleKey ?? 'receptionist',
      branchIds: branchId ? [branchId] : [],
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!branchId) {
      setError('root', { message: 'Add your branch address (step 2) before inviting staff.' });
      return;
    }
    try {
      const staff = await inviteStaff.mutateAsync({
        ...values,
        roleKey: fixedRoleKey ?? values.roleKey,
        branchIds: [branchId],
      });
      setInvited((prev) => [...prev, staff]);
      onInvited?.(staff);
      toast.success('Invitation sent', `${staff.name} will receive sign-in instructions by email.`);
      reset({
        ...EMPTY_INVITE_DEFAULTS,
        roleKey: fixedRoleKey ?? 'receptionist',
        branchIds: branchId ? [branchId] : [],
      });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not send the invitation.') });
    }
  });

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="staff-name" required error={errors.name?.message}>
            <Input id="staff-name" invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Email" htmlFor="staff-email" required error={errors.email?.message}>
            <Input id="staff-email" type="email" invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Phone" htmlFor="staff-phone" error={errors.phone?.message}>
            <Input id="staff-phone" invalid={!!errors.phone} {...register('phone')} />
          </Field>
          {!fixedRoleKey && (
            <Field label="Role" htmlFor="staff-role" required error={errors.roleKey?.message}>
              <Controller
                control={control}
                name="roleKey"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="staff-role" aria-invalid={!!errors.roleKey || undefined}>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role] ?? role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}
          {fixedRoleKey === 'doctor' && (
            <>
              <Field
                label="Specialization"
                htmlFor="staff-specialization"
                error={errors.specialization?.message}
              >
                <Input id="staff-specialization" {...register('specialization')} />
              </Field>
              <Field
                label="Qualification"
                htmlFor="staff-qualification"
                error={errors.qualification?.message}
              >
                <Input id="staff-qualification" {...register('qualification')} />
              </Field>
              <Field
                label="Registration number"
                htmlFor="staff-registration"
                error={errors.registrationNumber?.message}
              >
                <Input id="staff-registration" {...register('registrationNumber')} />
              </Field>
            </>
          )}
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}

        <Button
          type="submit"
          variant="secondary"
          loading={isSubmitting || inviteStaff.isPending}
          disabled={!branchId}
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {fixedRoleKey === 'doctor' ? 'Add doctor' : 'Send invitation'}
        </Button>
      </form>

      {invited.length > 0 && (
        <ul className="space-y-2" aria-label="Invited this session">
          {invited.map((staff) => (
            <li
              key={staff.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <span className="font-medium text-text-primary">{staff.name}</span>{' '}
                <span className="text-text-secondary">
                  &middot; {ROLE_LABELS[staff.roleKey] ?? staff.roleKey} &middot; {staff.email}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

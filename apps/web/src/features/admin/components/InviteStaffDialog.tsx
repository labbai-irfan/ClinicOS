import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import type { StaffDto } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { CLINIC_ROLE_KEYS, ROLE_LABELS } from '../labels';
import { inviteStaffSchema, useBranchesQuery, useInviteStaffMutation, type InviteStaffInput } from '../api';

const inviteStaffFormSchema = inviteStaffSchema
  .omit({ consultationFeePaise: true, followUpFeePaise: true, temporaryPassword: true })
  .extend({
    consultationFeeRupees: z.number().min(0).max(1_000_000).optional(),
    followUpFeeRupees: z.number().min(0).max(1_000_000).optional(),
  });
type InviteStaffFormValues = z.infer<typeof inviteStaffFormSchema>;

const EMPTY_DEFAULTS: InviteStaffFormValues = {
  name: '',
  email: '',
  phone: undefined,
  roleKey: 'receptionist',
  branchIds: [],
  specialization: undefined,
  qualification: undefined,
  registrationNumber: undefined,
  consultationFeeRupees: undefined,
  followUpFeeRupees: undefined,
};

export function InviteStaffDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited?: (staff: StaffDto) => void;
}) {
  const { data: branches } = useBranchesQuery();
  const inviteStaff = useInviteStaffMutation();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteStaffFormValues>({
    resolver: zodResolver(inviteStaffFormSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  const roleKey = useWatch({ control, name: 'roleKey' });
  const isDoctor = roleKey === 'doctor';

  useEffect(() => {
    if (!open) reset(EMPTY_DEFAULTS);
  }, [open, reset]);

  const close = () => {
    reset(EMPTY_DEFAULTS);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: InviteStaffInput = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      roleKey: values.roleKey,
      branchIds: values.branchIds,
      specialization: isDoctor ? values.specialization : undefined,
      qualification: isDoctor ? values.qualification : undefined,
      registrationNumber: isDoctor ? values.registrationNumber : undefined,
      consultationFeePaise:
        isDoctor && values.consultationFeeRupees != null
          ? Math.round(values.consultationFeeRupees * 100)
          : undefined,
      followUpFeePaise:
        isDoctor && values.followUpFeeRupees != null
          ? Math.round(values.followUpFeeRupees * 100)
          : undefined,
    };
    try {
      const staff = await inviteStaff.mutateAsync(payload);
      // No outbound invite email exists yet — when the server generated a one-time
      // password (no temporaryPassword was set above), it's only ever returned this
      // once. Surface it so the admin has a way to hand it to the new staffer.
      if (staff.temporaryPassword) {
        toast.success(
          'Invitation created',
          `${staff.name}'s temporary password is: ${staff.temporaryPassword} — share it with them securely; it will not be shown again.`,
        );
      } else {
        toast.success('Invitation sent', `${staff.name} can sign in with the password you set.`);
      }
      onInvited?.(staff);
      close();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not send the invitation.') });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent title="Invite staff" description="Send sign-in instructions to a new team member.">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="invite-name" required error={errors.name?.message}>
                <Input id="invite-name" autoFocus invalid={!!errors.name} {...register('name')} />
              </Field>
              <Field label="Email" htmlFor="invite-email" required error={errors.email?.message}>
                <Input id="invite-email" type="email" invalid={!!errors.email} {...register('email')} />
              </Field>
              <Field label="Phone" htmlFor="invite-phone" error={errors.phone?.message}>
                <Input
                  id="invite-phone"
                  type="tel"
                  invalid={!!errors.phone}
                  {...register('phone', { setValueAs: (v: string) => (v === '' ? undefined : v) })}
                />
              </Field>
              <Field label="Role" htmlFor="invite-role" required error={errors.roleKey?.message}>
                <Controller
                  control={control}
                  name="roleKey"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="invite-role" aria-invalid={!!errors.roleKey || undefined}>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLINIC_ROLE_KEYS.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field
              label="Branches"
              htmlFor="invite-branches"
              required
              error={errors.branchIds?.message}
              hint="Assign at least one branch this staff member can work from"
            >
              <Controller
                control={control}
                name="branchIds"
                render={({ field }) => (
                  <div id="invite-branches" className="space-y-2 rounded border border-border p-3">
                    {(branches ?? []).length === 0 && (
                      <p className="text-sm text-text-secondary">No branches set up yet.</p>
                    )}
                    {(branches ?? []).map((branch) => {
                      const checked = field.value?.includes(branch.id) ?? false;
                      return (
                        <label
                          key={branch.id}
                          className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm text-text-primary"
                        >
                          <input
                            type="checkbox"
                            className="h-5 w-5 rounded border-border"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(field.value ?? []);
                              if (e.target.checked) next.add(branch.id);
                              else next.delete(branch.id);
                              field.onChange(Array.from(next));
                            }}
                          />
                          {branch.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            {isDoctor && (
              <div className="space-y-4 rounded border border-border p-3">
                <p className="text-sm font-medium text-text-primary">Doctor details</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Specialization"
                    htmlFor="invite-specialization"
                    error={errors.specialization?.message}
                  >
                    <Input id="invite-specialization" {...register('specialization')} />
                  </Field>
                  <Field
                    label="Qualification"
                    htmlFor="invite-qualification"
                    error={errors.qualification?.message}
                  >
                    <Input id="invite-qualification" {...register('qualification')} />
                  </Field>
                  <Field
                    label="Registration number"
                    htmlFor="invite-registration"
                    error={errors.registrationNumber?.message}
                  >
                    <Input id="invite-registration" {...register('registrationNumber')} />
                  </Field>
                  <Field
                    label="Consultation fee (₹)"
                    htmlFor="invite-consultation-fee"
                    error={errors.consultationFeeRupees?.message}
                  >
                    <Input
                      id="invite-consultation-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      {...register('consultationFeeRupees', {
                        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                      })}
                    />
                  </Field>
                  <Field
                    label="Follow-up fee (₹)"
                    htmlFor="invite-followup-fee"
                    error={errors.followUpFeeRupees?.message}
                  >
                    <Input
                      id="invite-followup-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      {...register('followUpFeeRupees', {
                        setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                      })}
                    />
                  </Field>
                </div>
              </div>
            )}

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || inviteStaff.isPending}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Send invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

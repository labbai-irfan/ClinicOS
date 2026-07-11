import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Building2 } from 'lucide-react';
import { WEEKDAYS, type BranchDto, type Weekday } from '@clinicos/types';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { WEEKDAY_LABELS } from '../labels';
import {
  branchSchema,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  type BranchInput,
} from '../api';

type WorkingHours = BranchInput['workingHours'];

function defaultWorkingHours(): NonNullable<WorkingHours> {
  return WEEKDAYS.map((day) => ({ day, open: '09:00', close: '18:00', closed: day === 'sunday' }));
}

const addressFieldsSchema = branchSchema.omit({ workingHours: true });
type AddressFormValues = z.infer<typeof addressFieldsSchema>;

export function BranchEditDialog({
  open,
  onClose,
  branch,
}: {
  open: boolean;
  onClose: () => void;
  /** Omit to create a new branch. */
  branch?: BranchDto;
}) {
  const createBranch = useCreateBranchMutation();
  const updateBranch = useUpdateBranchMutation();
  const isEditing = Boolean(branch);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFieldsSchema),
    defaultValues: { name: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', phone: '' },
  });

  const [workingHours, setWorkingHours] = useState<NonNullable<WorkingHours>>(defaultWorkingHours());

  useEffect(() => {
    if (!open) return;
    if (branch) {
      reset({
        name: branch.name,
        addressLine1: branch.addressLine1 ?? '',
        addressLine2: branch.addressLine2 ?? '',
        city: branch.city ?? '',
        state: branch.state ?? '',
        postalCode: branch.postalCode ?? '',
        phone: branch.phone ?? '',
      });
      setWorkingHours(
        WEEKDAYS.map(
          (day) =>
            branch.workingHours.find((w) => w.day === day) ?? {
              day,
              open: '09:00',
              close: '18:00',
              closed: day === 'sunday',
            },
        ),
      );
    } else {
      reset({ name: '', addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', phone: '' });
      setWorkingHours(defaultWorkingHours());
    }
  }, [open, branch, reset]);

  const close = () => onClose();

  function updateDay(day: Weekday, patch: Partial<{ open: string; close: string; closed: boolean }>) {
    setWorkingHours((prev) => prev.map((w) => (w.day === day ? { ...w, ...patch } : w)));
  }

  const onSubmit = handleSubmit(async (values) => {
    const payload = { ...values, workingHours };
    try {
      if (branch) {
        await updateBranch.mutateAsync({ branchId: branch.id, input: payload });
        toast.success('Branch updated', branch.name);
      } else {
        const created = await createBranch.mutateAsync(payload);
        toast.success('Branch created', created.name);
      }
      close();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save the branch.') });
    }
  });

  const pending = createBranch.isPending || updateBranch.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent
          title={isEditing ? 'Edit branch' : 'Add branch'}
          description="Branch address and working hours."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Branch name" htmlFor="branch-name" required error={errors.name?.message}>
              <Input id="branch-name" autoFocus invalid={!!errors.name} {...register('name')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" htmlFor="branch-address1" error={errors.addressLine1?.message}>
                <Input id="branch-address1" {...register('addressLine1')} />
              </Field>
              <Field label="Address line 2" htmlFor="branch-address2" error={errors.addressLine2?.message}>
                <Input id="branch-address2" {...register('addressLine2')} />
              </Field>
              <Field label="City" htmlFor="branch-city" error={errors.city?.message}>
                <Input id="branch-city" {...register('city')} />
              </Field>
              <Field label="State" htmlFor="branch-state" error={errors.state?.message}>
                <Input id="branch-state" {...register('state')} />
              </Field>
              <Field label="Postal code" htmlFor="branch-postal" error={errors.postalCode?.message}>
                <Input id="branch-postal" {...register('postalCode')} />
              </Field>
              <Field label="Phone" htmlFor="branch-phone" error={errors.phone?.message}>
                <Input id="branch-phone" type="tel" {...register('phone')} />
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Working hours</p>
              <div className="space-y-2 rounded border border-border p-3">
                {workingHours.map((entry) => (
                  <div key={entry.day} className="flex flex-wrap items-center gap-2">
                    <span className="w-24 text-sm text-text-primary">{WEEKDAY_LABELS[entry.day]}</span>
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={entry.closed}
                        onChange={(e) => updateDay(entry.day, { closed: e.target.checked })}
                      />
                      Closed
                    </label>
                    {!entry.closed && (
                      <>
                        <Input
                          type="time"
                          className="w-28"
                          aria-label={`${WEEKDAY_LABELS[entry.day]} opens`}
                          value={entry.open}
                          onChange={(e) => updateDay(entry.day, { open: e.target.value })}
                        />
                        <span className="text-text-secondary">to</span>
                        <Input
                          type="time"
                          className="w-28"
                          aria-label={`${WEEKDAY_LABELS[entry.day]} closes`}
                          value={entry.close}
                          onChange={(e) => updateDay(entry.day, { close: e.target.value })}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || pending}>
                <Building2 className="h-4 w-4" aria-hidden="true" />
                {isEditing ? 'Save branch' : 'Create branch'}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

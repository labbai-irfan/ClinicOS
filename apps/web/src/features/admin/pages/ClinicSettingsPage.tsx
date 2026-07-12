import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Save } from 'lucide-react';
import { PERMISSIONS, REJOIN_POLICIES, type BranchDto } from '@clinicos/types';
import { optionalText } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import {
  tokenSettingsSchema,
  updateClinicSchema,
  updateClinicSettingsSchema,
  useBranchesQuery,
  useClinicQuery,
  useClinicSettingsQuery,
  useTokenSettingsQuery,
  useUpdateClinicMutation,
  useUpdateClinicSettingsMutation,
  useUpdateTokenSettingsMutation,
  type TokenSettingsInput,
  type UpdateClinicInput,
  type UpdateClinicSettingsInput,
} from '../api';
import { BranchEditDialog } from '../components/BranchEditDialog';

const REJOIN_POLICY_LABELS: Record<(typeof REJOIN_POLICIES)[number], string> = {
  after_next_patient: 'After the next patient',
  after_two_patients: 'After two patients',
  end_of_priority_group: 'End of priority group',
  manual: 'Manual (staff decides)',
};

const prescriptionBrandingSchema = z.object({
  prescriptionHeader: optionalText(1000),
  prescriptionFooter: optionalText(1000),
});
type PrescriptionBrandingValues = z.infer<typeof prescriptionBrandingSchema>;

function ClinicIdentitySection({ canManage }: { canManage: boolean }) {
  const { data: clinic, isLoading, isError, refetch } = useClinicQuery();
  const updateClinic = useUpdateClinicMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UpdateClinicInput>({
    resolver: zodResolver(updateClinicSchema),
    defaultValues: { name: '', phone: '', email: '', timezone: 'Asia/Kolkata' },
  });

  useEffect(() => {
    if (clinic) {
      reset({ name: clinic.name, phone: clinic.phone ?? '', email: clinic.email ?? '', timezone: clinic.timezone });
    }
  }, [clinic, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateClinic.mutateAsync(values);
      toast.success('Clinic details updated');
    } catch (err) {
      toast.error('Could not update clinic details', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clinic identity</CardTitle>
        <CardDescription>Name and contact details shown across the app and on printouts.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} data={clinic} onRetry={() => void refetch()}>
          {() => (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Clinic name" htmlFor="clinic-name" required error={errors.name?.message}>
                  <Input id="clinic-name" disabled={!canManage} invalid={!!errors.name} {...register('name')} />
                </Field>
                <Field label="Timezone" htmlFor="clinic-timezone" error={errors.timezone?.message}>
                  <Input id="clinic-timezone" disabled={!canManage} {...register('timezone')} />
                </Field>
                <Field label="Phone" htmlFor="clinic-phone" error={errors.phone?.message}>
                  <Input id="clinic-phone" type="tel" disabled={!canManage} {...register('phone')} />
                </Field>
                <Field label="Email" htmlFor="clinic-email" error={errors.email?.message}>
                  <Input id="clinic-email" type="email" disabled={!canManage} {...register('email')} />
                </Field>
              </div>
              {canManage && (
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!isDirty} loading={isSubmitting || updateClinic.isPending}>
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Save
                  </Button>
                </div>
              )}
            </form>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function PrescriptionBrandingSection({ canManage }: { canManage: boolean }) {
  const { data: clinic, isLoading, isError, refetch } = useClinicQuery();
  const updateClinic = useUpdateClinicMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<PrescriptionBrandingValues>({
    resolver: zodResolver(prescriptionBrandingSchema),
    defaultValues: { prescriptionHeader: '', prescriptionFooter: '' },
  });

  useEffect(() => {
    if (clinic) {
      reset({
        prescriptionHeader: clinic.prescriptionHeader ?? '',
        prescriptionFooter: clinic.prescriptionFooter ?? '',
      });
    }
  }, [clinic, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateClinic.mutateAsync(values);
      toast.success('Prescription branding updated');
    } catch (err) {
      toast.error('Could not update prescription branding', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prescription branding</CardTitle>
        <CardDescription>Header and footer text printed on every prescription.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} data={clinic} onRetry={() => void refetch()}>
          {() => (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field label="Header" htmlFor="rx-header" error={errors.prescriptionHeader?.message}>
                <Textarea id="rx-header" rows={2} disabled={!canManage} {...register('prescriptionHeader')} />
              </Field>
              <Field label="Footer" htmlFor="rx-footer" error={errors.prescriptionFooter?.message}>
                <Textarea id="rx-footer" rows={2} disabled={!canManage} {...register('prescriptionFooter')} />
              </Field>
              {canManage && (
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!isDirty} loading={isSubmitting || updateClinic.isPending}>
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Save
                  </Button>
                </div>
              )}
            </form>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function BranchesSection({ canManage }: { canManage: boolean }) {
  const { data: branches, isLoading, isError, refetch } = useBranchesQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchDto | undefined>(undefined);

  function openCreate() {
    setEditingBranch(undefined);
    setDialogOpen(true);
  }
  function openEdit(branch: BranchDto) {
    setEditingBranch(branch);
    setDialogOpen(true);
  }

  function workingHoursSummary(branch: BranchDto): string {
    const [first, ...rest] = branch.workingHours.filter((w) => !w.closed);
    if (!first) return 'No hours set';
    const count = rest.length + 1;
    return `${count} day${count === 1 ? '' : 's'} open · ${first.open}–${first.close}`;
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Address and working hours for each branch.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add branch
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <QueryBoundary
          isLoading={isLoading}
          isError={isError}
          data={branches}
          onRetry={() => void refetch()}
          isEmpty={(d) => d.length === 0}
          emptyTitle="No branches yet"
        >
          {(items) => (
            <ul className="space-y-2">
              {items.map((branch) => (
                <li
                  key={branch.id}
                  className="flex flex-col gap-2 rounded border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-text-primary">{branch.name}</p>
                    <p className="text-sm text-text-secondary">
                      {[branch.addressLine1, branch.city, branch.state].filter(Boolean).join(', ') || 'No address on file'}
                    </p>
                    <p className="text-xs text-text-secondary">{workingHoursSummary(branch)}</p>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(branch)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
      {canManage && (
        <BranchEditDialog open={dialogOpen} onClose={() => setDialogOpen(false)} branch={editingBranch} />
      )}
    </Card>
  );
}

function AppointmentQueueRulesSection({ canManage }: { canManage: boolean }) {
  const { data: settings, isLoading, isError, refetch } = useClinicSettingsQuery();
  const updateSettings = useUpdateClinicSettingsMutation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<UpdateClinicSettingsInput>({
    resolver: zodResolver(updateClinicSettingsSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (settings) {
      reset({
        appointmentWindowMinutes: settings.appointmentWindowMinutes,
        appointmentBufferMinutes: settings.appointmentBufferMinutes,
        rejoinPolicy: settings.rejoinPolicy,
        walkInCapacityPerDay: settings.walkInCapacityPerDay,
        prescriptionShowDiagnosisDefault: settings.prescriptionShowDiagnosisDefault,
      });
    }
  }, [settings, reset]);

  const rejoinPolicy = watch('rejoinPolicy');
  const showDiagnosis = watch('prescriptionShowDiagnosisDefault');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateSettings.mutateAsync(values);
      toast.success('Appointment & queue rules updated');
    } catch (err) {
      toast.error('Could not update rules', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointment & queue rules</CardTitle>
        <CardDescription>Defaults used across booking and the live queue.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} data={settings} onRetry={() => void refetch()}>
          {() => (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Appointment window (minutes)"
                  htmlFor="appointmentWindowMinutes"
                  error={errors.appointmentWindowMinutes?.message}
                >
                  <Input
                    id="appointmentWindowMinutes"
                    type="number"
                    min={5}
                    max={180}
                    disabled={!canManage}
                    {...register('appointmentWindowMinutes', { valueAsNumber: true })}
                  />
                </Field>
                <Field
                  label="Buffer (minutes)"
                  htmlFor="appointmentBufferMinutes"
                  error={errors.appointmentBufferMinutes?.message}
                >
                  <Input
                    id="appointmentBufferMinutes"
                    type="number"
                    min={0}
                    max={60}
                    disabled={!canManage}
                    {...register('appointmentBufferMinutes', { valueAsNumber: true })}
                  />
                </Field>
                <Field
                  label="Walk-in capacity per day"
                  htmlFor="walkInCapacityPerDay"
                  error={errors.walkInCapacityPerDay?.message}
                >
                  <Input
                    id="walkInCapacityPerDay"
                    type="number"
                    min={0}
                    max={500}
                    disabled={!canManage}
                    {...register('walkInCapacityPerDay', { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Rejoin policy" htmlFor="rejoinPolicy" error={errors.rejoinPolicy?.message}>
                  <Select
                    value={rejoinPolicy}
                    onValueChange={(v) => setValue('rejoinPolicy', v as UpdateClinicSettingsInput['rejoinPolicy'], { shouldDirty: true })}
                  >
                    <SelectTrigger id="rejoinPolicy" disabled={!canManage}>
                      <SelectValue placeholder="Select a policy" />
                    </SelectTrigger>
                    <SelectContent>
                      {REJOIN_POLICIES.map((policy) => (
                        <SelectItem key={policy} value={policy}>
                          {REJOIN_POLICY_LABELS[policy]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-border px-3 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-border"
                  checked={showDiagnosis ?? false}
                  disabled={!canManage}
                  onChange={(e) => setValue('prescriptionShowDiagnosisDefault', e.target.checked, { shouldDirty: true })}
                />
                Include diagnosis on prescriptions by default
              </label>
              {canManage && (
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!isDirty} loading={isSubmitting || updateSettings.isPending}>
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    Save
                  </Button>
                </div>
              )}
            </form>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function TokenSettingsSection({ canManage }: { canManage: boolean }) {
  const { data: branches } = useBranchesQuery();
  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    if (!branchId && branches?.[0]) setBranchId(branches[0].id);
  }, [branches, branchId]);

  const { data: tokenSettings, isLoading, isError, refetch } = useTokenSettingsQuery(branchId || undefined);
  const updateTokenSettings = useUpdateTokenSettingsMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<TokenSettingsInput>({
    resolver: zodResolver(tokenSettingsSchema),
    defaultValues: { branchId: '', mode: 'branch', prefix: 'A', pad: 3, dailyReset: true },
  });

  useEffect(() => {
    if (tokenSettings) {
      reset({
        branchId: tokenSettings.branchId,
        mode: tokenSettings.mode,
        prefix: tokenSettings.prefix,
        pad: tokenSettings.pad,
        dailyReset: tokenSettings.dailyReset,
      });
    } else if (branchId) {
      reset({ branchId, mode: 'branch', prefix: 'A', pad: 3, dailyReset: true });
    }
  }, [tokenSettings, branchId, reset]);

  const mode = watch('mode');
  const dailyReset = watch('dailyReset');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateTokenSettings.mutateAsync({ ...values, branchId });
      toast.success('Token settings updated');
    } catch (err) {
      toast.error('Could not update token settings', apiErrorMessage(err));
    }
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Token settings</CardTitle>
          <CardDescription>How queue tokens are numbered, per branch.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Branch" htmlFor="token-branch">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="token-branch">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {(branches ?? []).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {branchId && (
          <QueryBoundary isLoading={isLoading} isError={isError} data={tokenSettings} onRetry={() => void refetch()}>
            {() => (
              <form onSubmit={onSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Numbering scope" htmlFor="token-mode" error={errors.mode?.message}>
                    <Select
                      value={mode}
                      onValueChange={(v) => setValue('mode', v as TokenSettingsInput['mode'], { shouldDirty: true })}
                    >
                      <SelectTrigger id="token-mode" disabled={!canManage}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="branch">Per branch</SelectItem>
                        <SelectItem value="doctor">Per doctor</SelectItem>
                        <SelectItem value="department">Per department</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Prefix" htmlFor="token-prefix" error={errors.prefix?.message}>
                    <Input id="token-prefix" maxLength={6} disabled={!canManage} {...register('prefix')} />
                  </Field>
                  <Field label="Number padding" htmlFor="token-pad" error={errors.pad?.message}>
                    <Input
                      id="token-pad"
                      type="number"
                      min={2}
                      max={5}
                      disabled={!canManage}
                      {...register('pad', { valueAsNumber: true })}
                    />
                  </Field>
                </div>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded border border-border px-3 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border"
                    checked={dailyReset ?? true}
                    disabled={!canManage}
                    onChange={(e) => setValue('dailyReset', e.target.checked, { shouldDirty: true })}
                  />
                  Reset token numbers every day
                </label>
                {canManage && (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!isDirty}
                      loading={isSubmitting || updateTokenSettings.isPending}
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      Save
                    </Button>
                  </div>
                )}
              </form>
            )}
          </QueryBoundary>
        )}
      </CardContent>
    </Card>
  );
}

export default function ClinicSettingsPage() {
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.SETTINGS_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinic Settings"
        description="Identity, branches, prescription branding, and booking rules."
      />
      <ClinicIdentitySection canManage={canManage} />
      <BranchesSection canManage={canManage} />
      <PrescriptionBrandingSection canManage={canManage} />
      <AppointmentQueueRulesSection canManage={canManage} />
      <TokenSettingsSection canManage={canManage} />
    </div>
  );
}

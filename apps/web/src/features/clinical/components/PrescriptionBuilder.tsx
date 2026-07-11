import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Printer, Save, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '@clinicos/types';
import { prescriptionSchema, type PrescriptionInput } from '@clinicos/validation';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Input, Textarea } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { Tooltip } from '../../../components/ui/Tooltip';
import { StatusPill } from '../../../components/ui/StatusPill';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { usePermission } from '../../../hooks/use-permission';
import {
  openPrescriptionPdf,
  usePrescriptionQuery,
  useSavePrescriptionMutation,
} from '../api';
import { ChipList } from './ChipList';
import { formatDateTime } from '../utils';

type PrescriptionItemInput = PrescriptionInput['items'][number];

const EMPTY_ITEM: PrescriptionItemInput = {
  medicineName: '',
  genericName: '',
  form: '',
  strength: '',
  dose: '',
  route: '',
  frequency: '',
  timing: '',
  instruction: '',
};

const FOOD_RELATION_LABELS: Record<NonNullable<PrescriptionItemInput['foodRelation']>, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  any: 'Any time',
};

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

export function PrescriptionBuilder({
  consultationId,
  patientName,
  open,
  onOpenChange,
}: {
  consultationId: string;
  patientName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { has } = usePermission();
  const canSign = has(PERMISSIONS.PRESCRIPTION_SIGN);
  const prescriptionQuery = usePrescriptionQuery(consultationId);
  const savePrescription = useSavePrescriptionMutation();
  const [savingMode, setSavingMode] = useState<'draft' | 'finalize' | null>(null);
  const [printing, setPrinting] = useState(false);

  const current = prescriptionQuery.data?.current ?? null;

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PrescriptionInput>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      consultationId,
      items: [EMPTY_ITEM],
      advice: '',
      testsRecommended: [],
      includeDiagnosis: false,
      finalize: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' }) ?? [];

  useEffect(() => {
    if (!current) return;
    reset({
      consultationId,
      items: current.items.length > 0 ? current.items : [EMPTY_ITEM],
      advice: current.advice ?? '',
      testsRecommended: current.testsRecommended,
      followUpDate: current.followUpAt?.slice(0, 10),
      includeDiagnosis: current.includeDiagnosis,
      finalize: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only when the loaded record changes
  }, [current?.id, current?.versionNumber]);

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of watchedItems) {
      const key = normalizedName(item?.medicineName ?? '');
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [watchedItems]);

  const hasDuplicates = duplicateNames.size > 0;

  async function onSave(finalize: boolean) {
    await handleSubmit(async (values) => {
      setSavingMode(finalize ? 'finalize' : 'draft');
      try {
        const dto = await savePrescription.mutateAsync({ ...values, consultationId, finalize });
        if (finalize) {
          toast.success('Prescription finalized', `Version ${dto.versionNumber} signed.`);
          setPrinting(true);
          try {
            await openPrescriptionPdf(dto.id);
          } finally {
            setPrinting(false);
          }
        } else {
          toast.success('Prescription draft saved');
        }
      } catch (err) {
        toast.error(finalize ? 'Could not finalize prescription' : 'Could not save draft', apiErrorMessage(err));
      } finally {
        setSavingMode(null);
      }
    })();
  }

  async function onPrint() {
    if (!current) return;
    setPrinting(true);
    try {
      await openPrescriptionPdf(current.id);
    } catch (err) {
      toast.error('Could not open the prescription PDF', apiErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Prescription"
        description={patientName ? `For ${patientName}` : undefined}
        className="max-w-3xl"
      >
        <div className="space-y-5">
          {current && (
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={current.status === 'finalized' ? `Finalized v${current.versionNumber}` : 'Draft'}
                tone={current.status === 'finalized' ? 'success' : 'neutral'}
              />
              {current.finalizedAt && (
                <span className="text-xs text-text-secondary">Signed {formatDateTime(current.finalizedAt)}</span>
              )}
              {current.verificationCode && (
                <span className="font-mono text-xs text-text-secondary">Code: {current.verificationCode}</span>
              )}
            </div>
          )}

          {hasDuplicates && (
            <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Some medicines appear more than once in this prescription. Review before finalizing.</span>
            </div>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const medicineName = watchedItems[index]?.medicineName ?? '';
              const isDuplicate = duplicateNames.has(normalizedName(medicineName));
              return (
                <div key={field.id} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text-primary">Medicine {index + 1}</p>
                    <div className="flex items-center gap-2">
                      {isDuplicate && (
                        <Tooltip label="Duplicate medicine name in this prescription">
                          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                        </Tooltip>
                      )}
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          aria-label={`Remove medicine ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field
                      label="Medicine name"
                      htmlFor={`items.${index}.medicineName`}
                      required
                      error={errors.items?.[index]?.medicineName?.message}
                    >
                      <Input
                        id={`items.${index}.medicineName`}
                        invalid={!!errors.items?.[index]?.medicineName}
                        {...register(`items.${index}.medicineName` as const)}
                      />
                    </Field>
                    <Field label="Generic name" htmlFor={`items.${index}.genericName`}>
                      <Input id={`items.${index}.genericName`} {...register(`items.${index}.genericName` as const)} />
                    </Field>
                    <Field label="Form" htmlFor={`items.${index}.form`} hint="e.g. Tablet, Syrup">
                      <Input id={`items.${index}.form`} {...register(`items.${index}.form` as const)} />
                    </Field>
                    <Field label="Strength" htmlFor={`items.${index}.strength`} hint="e.g. 500mg">
                      <Input id={`items.${index}.strength`} {...register(`items.${index}.strength` as const)} />
                    </Field>
                    <Field
                      label="Dose"
                      htmlFor={`items.${index}.dose`}
                      required
                      error={errors.items?.[index]?.dose?.message}
                    >
                      <Input
                        id={`items.${index}.dose`}
                        invalid={!!errors.items?.[index]?.dose}
                        {...register(`items.${index}.dose` as const)}
                      />
                    </Field>
                    <Field label="Route" htmlFor={`items.${index}.route`} hint="e.g. Oral">
                      <Input id={`items.${index}.route`} {...register(`items.${index}.route` as const)} />
                    </Field>
                    <Field
                      label="Frequency"
                      htmlFor={`items.${index}.frequency`}
                      required
                      hint="e.g. Twice daily"
                      error={errors.items?.[index]?.frequency?.message}
                    >
                      <Input
                        id={`items.${index}.frequency`}
                        invalid={!!errors.items?.[index]?.frequency}
                        {...register(`items.${index}.frequency` as const)}
                      />
                    </Field>
                    <Field label="Duration (days)" htmlFor={`items.${index}.durationDays`}>
                      <Input
                        id={`items.${index}.durationDays`}
                        type="number"
                        inputMode="numeric"
                        {...register(`items.${index}.durationDays` as const, { valueAsNumber: true })}
                      />
                    </Field>
                    <Field label="Timing" htmlFor={`items.${index}.timing`} hint="e.g. Morning, Night">
                      <Input id={`items.${index}.timing`} {...register(`items.${index}.timing` as const)} />
                    </Field>
                    <Field label="Food relation" htmlFor={`items.${index}.foodRelation`}>
                      <Controller
                        control={control}
                        name={`items.${index}.foodRelation` as const}
                        render={({ field: selectField }) => (
                          <Select
                            value={selectField.value ?? undefined}
                            onValueChange={(value) => selectField.onChange(value)}
                          >
                            <SelectTrigger id={`items.${index}.foodRelation`}>
                              <SelectValue placeholder="Not specified" />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(FOOD_RELATION_LABELS) as Array<keyof typeof FOOD_RELATION_LABELS>).map(
                                (key) => (
                                  <SelectItem key={key} value={key}>
                                    {FOOD_RELATION_LABELS[key]}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Instruction" htmlFor={`items.${index}.instruction`} hint="e.g. Take with water">
                      <Input id={`items.${index}.instruction`} {...register(`items.${index}.instruction` as const)} />
                    </Field>
                  </div>
                </div>
              );
            })}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_ITEM })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add medicine
          </Button>

          <Field label="Advice" htmlFor="prescription-advice">
            <Textarea id="prescription-advice" rows={2} {...register('advice')} />
          </Field>

          <Controller
            control={control}
            name="testsRecommended"
            render={({ field }) => (
              <ChipList
                label="Recommended tests"
                values={field.value ?? []}
                onChange={field.onChange}
                placeholder="e.g. CBC"
                maxLength={200}
                maxItems={30}
              />
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Follow-up date" htmlFor="prescription-follow-up">
              <Input id="prescription-follow-up" type="date" {...register('followUpDate')} />
            </Field>
            <div className="flex items-end pb-2">
              <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" className="h-4 w-4 rounded border-border" {...register('includeDiagnosis')} />
                Include diagnosis on printed prescription
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onPrint}
              disabled={!current || printing}
              loading={printing && savingMode === null}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onSave(false)}
              loading={savingMode === 'draft'}
              disabled={savingMode !== null}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save Draft
            </Button>
            <Tooltip label={canSign ? 'Finalize and sign this prescription' : 'Requires prescription sign permission'}>
              <span>
                <Button
                  type="button"
                  onClick={() => void onSave(true)}
                  loading={savingMode === 'finalize'}
                  disabled={!canSign || savingMode !== null}
                >
                  Finalize
                </Button>
              </span>
            </Tooltip>
          </div>
          {!canSign && (
            <p className="text-right text-xs text-text-secondary">
              You can save drafts, but finalizing requires the prescription sign permission.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

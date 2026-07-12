import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Save } from 'lucide-react';
import type { NurseAssessmentDto, PatientDto, QueueEntryDto, VitalRecordDto } from '@clinicos/types';
import { nurseAssessmentSchema, type NurseAssessmentInput } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { StatusPill } from '../../../components/ui/StatusPill';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import {
  useAssessmentQuery,
  usePatientSummaryQuery,
  useQueueEntryQuery,
  useSaveAssessmentMutation,
  useSaveVitalsMutation,
  useTransitionQueueMutation,
  useVitalsQuery,
} from '../api';
import { ChipList } from '../components/ChipList';
import { PainScale } from '../components/PainScale';
import { VitalsFields, VitalsReadonly } from '../components/VitalsFields';
import { alertTone, hasAnyVitalValue, queueStatusLabel, queueStatusTone, type VitalsValues } from '../utils';

export default function NurseAssessmentPage() {
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const navigate = useNavigate();

  const entryQuery = useQueueEntryQuery(queueEntryId);
  const entry = entryQuery.data;
  const assessmentQuery = useAssessmentQuery(queueEntryId);
  const vitalsQuery = useVitalsQuery({ queueEntryId });
  const patientQuery = usePatientSummaryQuery(entry?.patientId);
  const saveAssessment = useSaveAssessmentMutation();
  const saveVitals = useSaveVitalsMutation();
  const transitionQueue = useTransitionQueueMutation();

  const claimedRef = useRef(false);
  useEffect(() => {
    if (entry && !claimedRef.current && entry.status === 'waiting_for_nurse') {
      claimedRef.current = true;
      transitionQueue.mutate({ id: entry.id, to: 'nurse_assessment' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per loaded entry, guarded by the ref
  }, [entry]);

  const isLoading =
    entryQuery.isLoading || (!!entry && (assessmentQuery.isLoading || vitalsQuery.isLoading || patientQuery.isLoading));
  const isError = entryQuery.isError || assessmentQuery.isError;

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonRows rows={10} />
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <ErrorState
        title="Could not load this patient"
        description="This queue entry may no longer be on today's list. Go back and try again."
        onRetry={() => {
          void entryQuery.refetch();
          void assessmentQuery.refetch();
        }}
      />
    );
  }

  return (
    <NurseAssessmentForm
      entry={entry}
      patient={patientQuery.data}
      assessment={assessmentQuery.data ?? null}
      existingVitals={vitalsQuery.data?.[0] ?? null}
      saveAssessment={saveAssessment}
      saveVitals={saveVitals}
      transitionQueue={transitionQueue}
      onDone={() => navigate('/clinical/nurse')}
    />
  );
}

interface NurseAssessmentFormProps {
  entry: QueueEntryDto;
  patient: PatientDto | undefined;
  assessment: NurseAssessmentDto | null;
  existingVitals: VitalRecordDto | null;
  saveAssessment: ReturnType<typeof useSaveAssessmentMutation>;
  saveVitals: ReturnType<typeof useSaveVitalsMutation>;
  transitionQueue: ReturnType<typeof useTransitionQueueMutation>;
  onDone: () => void;
}

function NurseAssessmentForm({
  entry,
  patient,
  assessment,
  existingVitals,
  saveAssessment,
  saveVitals,
  transitionQueue,
  onDone,
}: NurseAssessmentFormProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NurseAssessmentInput>({
    resolver: zodResolver(nurseAssessmentSchema),
    defaultValues: {
      queueEntryId: entry.id,
      patientId: entry.patientId,
      chiefComplaint: '',
      symptoms: [],
      allergies: [],
      conditions: [],
      currentMedicines: [],
      complete: false,
    },
  });

  const [vitals, setVitals] = useState<VitalsValues>({});
  const [savingMode, setSavingMode] = useState<'draft' | 'complete' | null>(null);

  useEffect(() => {
    reset({
      queueEntryId: entry.id,
      patientId: entry.patientId,
      chiefComplaint: assessment?.chiefComplaint ?? '',
      symptoms: assessment?.symptoms ?? [],
      durationText: assessment?.durationText ?? '',
      painLevel: assessment?.painLevel,
      relevantHistory: assessment?.relevantHistory ?? '',
      allergies: assessment?.allergies ?? patient?.allergies ?? [],
      conditions: assessment?.conditions ?? patient?.conditions ?? [],
      currentMedicines: assessment?.currentMedicines ?? patient?.currentMedicines ?? [],
      previousTreatment: assessment?.previousTreatment ?? '',
      nurseNotes: assessment?.nurseNotes ?? '',
      complete: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only when the loaded records change
  }, [assessment?.id, patient?.id]);

  useEffect(() => {
    if (!existingVitals) return;
    setVitals({
      temperatureC: existingVitals.temperatureC,
      systolic: existingVitals.systolic,
      diastolic: existingVitals.diastolic,
      pulseBpm: existingVitals.pulseBpm,
      spo2Percent: existingVitals.spo2Percent,
      respiratoryRate: existingVitals.respiratoryRate,
      heightCm: existingVitals.heightCm,
      weightKg: existingVitals.weightKg,
      bloodGlucoseMgDl: existingVitals.bloodGlucoseMgDl,
    });
  }, [existingVitals]);

  const onSubmit = (complete: boolean) =>
    handleSubmit(async (values) => {
      setSavingMode(complete ? 'complete' : 'draft');
      try {
        await saveAssessment.mutateAsync({ ...values, complete });

        if (!existingVitals && hasAnyVitalValue(vitals)) {
          await saveVitals.mutateAsync({ patientId: entry.patientId, queueEntryId: entry.id, ...vitals });
        }

        if (complete) {
          let status = entry.status;
          if (status === 'waiting_for_nurse') {
            const updated = await transitionQueue.mutateAsync({ id: entry.id, to: 'nurse_assessment' });
            status = updated.status;
          }
          if (status !== 'ready_for_doctor') {
            await transitionQueue.mutateAsync({ id: entry.id, to: 'ready_for_doctor' });
          }
          toast.success('Assessment completed', `${entry.patientName ?? 'Patient'} sent to the doctor queue.`);
          onDone();
        } else {
          toast.success('Draft saved');
        }
      } catch (err) {
        toast.error(
          complete ? 'Could not complete assessment' : 'Could not save draft',
          apiErrorMessage(err),
        );
      } finally {
        setSavingMode(null);
      }
    });

  const busy = savingMode !== null;

  return (
    <div className="space-y-6 pb-28">
      <PageHeader
        title={entry.patientName ?? 'Patient'}
        description={`Token ${entry.token}${entry.age !== undefined ? ` · ${entry.age} yrs` : ''}${
          entry.reasonForVisit ? ` · ${entry.reasonForVisit}` : ''
        }`}
        actions={<StatusPill label={queueStatusLabel(entry.status)} tone={queueStatusTone(entry.status)} />}
      />

      {entry.alerts && entry.alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {entry.alerts.map((alert, i) => (
            <StatusPill key={i} label={alert.label} tone={alertTone(alert.severity)} />
          ))}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assessment</CardTitle>
            <CardDescription>Chief complaint, symptoms, and clinical background.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="Chief complaint"
              htmlFor="chiefComplaint"
              required
              error={errors.chiefComplaint?.message}
            >
              <Textarea
                id="chiefComplaint"
                rows={2}
                invalid={!!errors.chiefComplaint}
                {...register('chiefComplaint')}
              />
            </Field>

            <Controller
              control={control}
              name="symptoms"
              render={({ field }) => (
                <ChipList
                  label="Symptoms"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="e.g. Fever"
                  maxLength={160}
                  maxItems={30}
                />
              )}
            />

            <Field label="Duration" htmlFor="durationText" hint="e.g. 3 days" error={errors.durationText?.message}>
              <Input id="durationText" invalid={!!errors.durationText} {...register('durationText')} />
            </Field>

            <Controller
              control={control}
              name="painLevel"
              render={({ field }) => <PainScale value={field.value} onChange={field.onChange} />}
            />

            <Field label="Relevant history" htmlFor="relevantHistory" error={errors.relevantHistory?.message}>
              <Textarea id="relevantHistory" rows={3} invalid={!!errors.relevantHistory} {...register('relevantHistory')} />
            </Field>

            <Controller
              control={control}
              name="allergies"
              render={({ field }) => (
                <ChipList
                  label="Allergies"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="e.g. Penicillin"
                  maxLength={120}
                  maxItems={50}
                  tone="danger"
                />
              )}
            />
            <Controller
              control={control}
              name="conditions"
              render={({ field }) => (
                <ChipList
                  label="Known conditions"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="e.g. Hypertension"
                  maxLength={120}
                  maxItems={50}
                />
              )}
            />
            <Controller
              control={control}
              name="currentMedicines"
              render={({ field }) => (
                <ChipList
                  label="Current medicines"
                  values={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="e.g. Metformin 500mg"
                  maxLength={160}
                  maxItems={100}
                />
              )}
            />

            <Field label="Previous treatment" htmlFor="previousTreatment" error={errors.previousTreatment?.message}>
              <Textarea id="previousTreatment" rows={3} invalid={!!errors.previousTreatment} {...register('previousTreatment')} />
            </Field>
            <Field label="Nurse notes" htmlFor="nurseNotes" error={errors.nurseNotes?.message}>
              <Textarea id="nurseNotes" rows={3} invalid={!!errors.nurseNotes} {...register('nurseNotes')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vitals</CardTitle>
            <CardDescription>
              {existingVitals ? 'Recorded for this visit.' : 'Record once — vitals cannot be edited after saving.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {existingVitals ? (
              <VitalsReadonly vitals={existingVitals} />
            ) : (
              <VitalsFields values={vitals} onChange={setVitals} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface p-4 shadow-popover">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onSubmit(false)}
            loading={savingMode === 'draft'}
            disabled={busy}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save Draft
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onSubmit(true)}
            loading={savingMode === 'complete'}
            disabled={busy}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Complete Assessment
          </Button>
        </div>
      </div>
    </div>
  );
}

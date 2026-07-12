import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Pencil, Pill, Save } from 'lucide-react';
import { PERMISSIONS } from '@clinicos/types';
import type {
  ConsultationDto,
  NurseAssessmentDto,
  PatientDto,
  QueueEntryDto,
  VitalRecordDto,
} from '@clinicos/types';
import { consultationSchema, type ConsultationInput } from '@clinicos/validation';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { StatusPill } from '../../../components/ui/StatusPill';
import { ErrorState } from '../../../components/ui/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { usePermission } from '../../../hooks/use-permission';
import {
  useAssessmentQuery,
  usePatientConsultationsQuery,
  usePatientSummaryQuery,
  useConsultationQuery,
  useQueueEntryQuery,
  useSaveConsultationMutation,
  useTransitionQueueMutation,
  useVitalsQuery,
} from '../api';
import { ChipList } from '../components/ChipList';
import { VitalsReadonly } from '../components/VitalsFields';
import { PatientSummaryPanel } from '../components/PatientSummaryPanel';
import { ConsultationHistoryPanel } from '../components/ConsultationHistoryPanel';
import { AmendConsultationDialog } from '../components/AmendConsultationDialog';
import { PrescriptionBuilder } from '../components/PrescriptionBuilder';
import { formatDateTime, painLevelLabel, queueStatusLabel, queueStatusTone } from '../utils';

export default function DoctorConsultationPage() {
  const { queueEntryId } = useParams<{ queueEntryId: string }>();
  const navigate = useNavigate();
  const { has } = usePermission();

  const entryQuery = useQueueEntryQuery(queueEntryId);
  const entry = entryQuery.data;
  const patientQuery = usePatientSummaryQuery(entry?.patientId);
  const assessmentQuery = useAssessmentQuery(queueEntryId);
  const visitVitalsQuery = useVitalsQuery({ queueEntryId });
  const trendVitalsQuery = useVitalsQuery({ patientId: entry?.patientId });
  const historyQuery = usePatientConsultationsQuery(entry?.patientId);
  const consultationQuery = useConsultationQuery(queueEntryId, entry?.patientId);
  const saveConsultation = useSaveConsultationMutation();
  const transitionQueue = useTransitionQueueMutation();

  const claimedRef = useRef(false);
  useEffect(() => {
    if (entry && !claimedRef.current && (entry.status === 'ready_for_doctor' || entry.status === 'waiting_for_doctor')) {
      claimedRef.current = true;
      transitionQueue.mutate({ id: entry.id, to: 'in_consultation' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per loaded entry, guarded by the ref
  }, [entry]);

  const isLoading =
    entryQuery.isLoading ||
    (!!entry &&
      (patientQuery.isLoading || assessmentQuery.isLoading || visitVitalsQuery.isLoading || consultationQuery.isLoading));
  const isError = entryQuery.isError || consultationQuery.isError;

  if (isLoading) {
    return (
      <div className="p-6">
        <SkeletonRows rows={12} />
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
          void consultationQuery.refetch();
        }}
      />
    );
  }

  return (
    <DoctorConsultationContent
      entry={entry}
      patient={patientQuery.data}
      assessment={assessmentQuery.data ?? null}
      visitVitals={visitVitalsQuery.data?.[0] ?? null}
      vitalsTrend={trendVitalsQuery.data ?? []}
      history={historyQuery.data ?? []}
      consultation={consultationQuery.data ?? null}
      saveConsultation={saveConsultation}
      transitionQueue={transitionQueue}
      canAmend={has(PERMISSIONS.CONSULTATION_AMEND)}
      onDone={() => navigate('/clinical/doctor')}
    />
  );
}

interface ContentProps {
  entry: QueueEntryDto;
  patient: PatientDto | undefined;
  assessment: NurseAssessmentDto | null;
  visitVitals: VitalRecordDto | null;
  vitalsTrend: VitalRecordDto[];
  history: ConsultationDto[];
  consultation: ConsultationDto | null;
  saveConsultation: ReturnType<typeof useSaveConsultationMutation>;
  transitionQueue: ReturnType<typeof useTransitionQueueMutation>;
  canAmend: boolean;
  onDone: () => void;
}

function DoctorConsultationContent({
  entry,
  patient,
  assessment,
  visitVitals,
  vitalsTrend,
  history,
  consultation,
  saveConsultation,
  transitionQueue,
  canAmend,
  onDone,
}: ContentProps) {
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [savingMode, setSavingMode] = useState<'draft' | 'complete' | null>(null);

  const isEditable = !consultation || consultation.status === 'draft';
  const consultationId = consultation?.id;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConsultationInput>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      patientId: entry.patientId,
      queueEntryId: entry.id,
      diagnosis: [],
      testsOrdered: [],
      complete: false,
    },
  });

  useEffect(() => {
    if (!consultation) return;
    reset({
      patientId: entry.patientId,
      queueEntryId: entry.id,
      symptoms: consultation.symptoms ?? '',
      examinationFindings: consultation.examinationFindings ?? '',
      clinicalNotes: consultation.clinicalNotes ?? '',
      diagnosis: consultation.diagnosis,
      treatmentPlan: consultation.treatmentPlan ?? '',
      advice: consultation.advice ?? '',
      testsOrdered: consultation.testsOrdered,
      followUpDate: consultation.followUpAt?.slice(0, 10),
      complete: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only when the loaded record changes
  }, [consultation?.id, consultation?.version]);

  const onSubmit = (complete: boolean) =>
    handleSubmit(async (values) => {
      setSavingMode(complete ? 'complete' : 'draft');
      try {
        await saveConsultation.mutateAsync({ ...values, patientId: entry.patientId, queueEntryId: entry.id, complete });

        if (complete) {
          let status = entry.status;
          if (status === 'ready_for_doctor' || status === 'waiting_for_doctor') {
            const updated = await transitionQueue.mutateAsync({ id: entry.id, to: 'in_consultation' });
            status = updated.status;
          }
          if (status !== 'consultation_completed') {
            await transitionQueue.mutateAsync({ id: entry.id, to: 'consultation_completed' });
          }
          toast.success('Consultation completed', 'You can still add or finalize the prescription.');
        } else {
          toast.success('Draft saved');
        }
      } catch (err) {
        toast.error(
          complete ? 'Could not complete consultation' : 'Could not save draft',
          apiErrorMessage(err),
        );
      } finally {
        setSavingMode(null);
      }
    });

  const busy = savingMode !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={patient?.fullName ?? 'Consultation'}
        description={`Token ${entry.token}${entry.reasonForVisit ? ` · ${entry.reasonForVisit}` : ''}`}
        actions={
          <>
            <StatusPill label={queueStatusLabel(entry.status)} tone={queueStatusTone(entry.status)} />
            <Button type="button" variant="outline" size="sm" onClick={onDone}>
              Back to Worklist
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px] lg:items-start">
        <div className="lg:sticky lg:top-6">
          <PatientSummaryPanel patient={patient} entry={entry} />
        </div>

        <div className="space-y-6">
          <NurseHandoffCard assessment={assessment} vitals={visitVitals} />

          {isEditable ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Consultation</CardTitle>
                  <CardDescription>Examination, diagnosis, and treatment plan.</CardDescription>
                </div>
                {consultationId && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setPrescriptionOpen(true)}>
                    <Pill className="h-4 w-4" aria-hidden="true" />
                    Prescription
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                <Field label="Symptoms" htmlFor="symptoms" error={errors.symptoms?.message}>
                  <Textarea id="symptoms" rows={2} invalid={!!errors.symptoms} {...register('symptoms')} />
                </Field>
                <Field
                  label="Examination findings"
                  htmlFor="examinationFindings"
                  error={errors.examinationFindings?.message}
                >
                  <Textarea
                    id="examinationFindings"
                    rows={3}
                    invalid={!!errors.examinationFindings}
                    {...register('examinationFindings')}
                  />
                </Field>
                <Field label="Clinical notes" htmlFor="clinicalNotes" error={errors.clinicalNotes?.message}>
                  <Textarea id="clinicalNotes" rows={3} invalid={!!errors.clinicalNotes} {...register('clinicalNotes')} />
                </Field>
                <Controller
                  control={control}
                  name="diagnosis"
                  render={({ field }) => (
                    <ChipList
                      label="Diagnosis"
                      values={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="e.g. Viral fever"
                      maxLength={240}
                      maxItems={20}
                    />
                  )}
                />
                <Field label="Treatment plan" htmlFor="treatmentPlan" error={errors.treatmentPlan?.message}>
                  <Textarea id="treatmentPlan" rows={3} invalid={!!errors.treatmentPlan} {...register('treatmentPlan')} />
                </Field>
                <Field label="Advice" htmlFor="advice" error={errors.advice?.message}>
                  <Textarea id="advice" rows={2} invalid={!!errors.advice} {...register('advice')} />
                </Field>
                <Controller
                  control={control}
                  name="testsOrdered"
                  render={({ field }) => (
                    <ChipList
                      label="Tests ordered"
                      values={field.value ?? []}
                      onChange={field.onChange}
                      placeholder="e.g. CBC"
                      maxLength={200}
                      maxItems={30}
                    />
                  )}
                />
                <Field label="Follow-up date" htmlFor="followUpDate" error={errors.followUpDate?.message}>
                  <Input id="followUpDate" type="date" invalid={!!errors.followUpDate} {...register('followUpDate')} />
                </Field>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSubmit(false)}
                  loading={savingMode === 'draft'}
                  disabled={busy}
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Draft
                </Button>
                <Button type="button" onClick={onSubmit(true)} loading={savingMode === 'complete'} disabled={busy}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Complete Consultation
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Consultation</CardTitle>
                  <CardDescription>
                    {consultation!.status === 'amended' ? 'Completed, later amended' : 'Completed'} ·{' '}
                    {formatDateTime(consultation!.completedAt)}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPrescriptionOpen(true)}>
                    <Pill className="h-4 w-4" aria-hidden="true" />
                    Prescription
                  </Button>
                  {canAmend && consultation!.status === 'completed' && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setAmendOpen(true)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Amend
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <ReadonlyField label="Symptoms" value={consultation!.symptoms} />
                <ReadonlyField label="Examination findings" value={consultation!.examinationFindings} />
                <ReadonlyField label="Clinical notes" value={consultation!.clinicalNotes} />
                <ReadonlyChips label="Diagnosis" values={consultation!.diagnosis} />
                <ReadonlyField label="Treatment plan" value={consultation!.treatmentPlan} />
                <ReadonlyField label="Advice" value={consultation!.advice} />
                <ReadonlyChips label="Tests ordered" values={consultation!.testsOrdered} />
                <ReadonlyField
                  label="Follow-up"
                  value={consultation!.followUpAt ? formatDateTime(consultation!.followUpAt) : undefined}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <ConsultationHistoryPanel history={history} vitalsTrend={vitalsTrend} currentQueueEntryId={entry.id} />
        </div>
      </div>

      {consultationId && (
        <PrescriptionBuilder
          consultationId={consultationId}
          patientName={patient?.fullName}
          open={prescriptionOpen}
          onOpenChange={setPrescriptionOpen}
        />
      )}
      {consultation && consultation.status === 'completed' && (
        <AmendConsultationDialog consultation={consultation} open={amendOpen} onOpenChange={setAmendOpen} />
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-text-primary">{value || '—'}</p>
    </div>
  );
}

function ReadonlyChips({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      {values.length === 0 ? (
        <p className="mt-0.5 text-text-primary">—</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span key={i} className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-text-primary">
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nurse assessment + vitals shown read-only so the doctor never re-asks what's already known. */
function NurseHandoffCard({ assessment, vitals }: { assessment: NurseAssessmentDto | null; vitals: VitalRecordDto | null }) {
  if (!assessment && !vitals) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nurse handoff</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState title="No nurse assessment yet" description="This patient has not been assessed by a nurse." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nurse handoff</CardTitle>
        <CardDescription>Read-only — recorded during nurse assessment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {assessment && (
          <div className="space-y-3">
            <ReadonlyField label="Chief complaint" value={assessment.chiefComplaint} />
            <ReadonlyChips label="Symptoms" values={assessment.symptoms} />
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadonlyField label="Duration" value={assessment.durationText} />
              <ReadonlyField
                label="Pain level"
                value={assessment.painLevel !== undefined ? `${assessment.painLevel}/10 — ${painLevelLabel(assessment.painLevel)}` : undefined}
              />
            </div>
            <ReadonlyField label="Relevant history" value={assessment.relevantHistory} />
            <ReadonlyChips label="Allergies" values={assessment.allergies} />
            <ReadonlyChips label="Known conditions" values={assessment.conditions} />
            <ReadonlyChips label="Current medicines" values={assessment.currentMedicines} />
            <ReadonlyField label="Previous treatment" value={assessment.previousTreatment} />
            <ReadonlyField label="Nurse notes" value={assessment.nurseNotes} />
          </div>
        )}
        {vitals && (
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-secondary">Vitals</p>
            <VitalsReadonly vitals={vitals} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

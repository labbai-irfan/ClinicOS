import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { PERMISSIONS } from '@clinicos/types';
import type { PatientAlertDto } from '@clinicos/types';
import { computeAge } from '@clinicos/config';
import {
  Activity,
  CalendarClock,
  CalendarPlus,
  FileUp,
  FolderOpen,
  HeartPulse,
  ListPlus,
  Pencil,
  Pill,
  Receipt,
  Repeat,
  Save,
  Stethoscope,
  UserRoundX,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Input';
import { Card, CardContent } from '../../../components/ui/Card';
import { StatusPill, type StatusTone } from '../../../components/ui/StatusPill';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { usePermission } from '../../../hooks/use-permission';
import { usePatientQuery, useUpdatePatientMutation, type PatientProfileDto } from '../api';
import { TagListEditor } from '../components/TagListEditor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';

function alertTone(severity: PatientAlertDto['severity']): StatusTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function genderLabel(gender: PatientProfileDto['gender']): string {
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy, h:mm a');
  } catch {
    return '—';
  }
}

function ComingSoonTab({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return <EmptyState icon={icon} title={title} description={description} />;
}

export default function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { has } = usePermission();

  const { data: patient, isLoading, isError, error, refetch } = usePatientQuery(patientId);

  const notFound = isError && axios.isAxiosError(error) && error.response?.status === 404;

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <EmptyState
          icon={UserRoundX}
          title="Patient not found"
          description="This patient record doesn't exist, or it may have been merged into another record."
          action={
            <Button variant="outline" onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !patient) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  return <PatientProfileContent patient={patient} canEdit={has(PERMISSIONS.PATIENT_UPDATE)} />;
}

function PatientProfileContent({
  patient,
  canEdit,
}: {
  patient: PatientProfileDto;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const { has } = usePermission();
  const age = patient.age ?? computeAge(patient.dateOfBirth, patient.approximateAge);

  return (
    <div className="space-y-6">
      <PageHeader title={patient.fullName} description={`Patient code ${patient.code}`} />

      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text-primary">{patient.fullName}</h2>
                <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 font-mono text-xs text-text-secondary">
                  {patient.code}
                </span>
                {patient.isTemporary && <StatusPill label="Temporary record" tone="neutral" />}
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {age !== undefined ? `${age} yrs` : 'Age unknown'} · {genderLabel(patient.gender)}
                {patient.mobile ? ` · ${patient.mobile}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {has(PERMISSIONS.QUEUE_MANAGE) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/queue?patientId=${patient.id}`)}
                >
                  <ListPlus className="h-4 w-4" aria-hidden="true" />
                  Add to queue
                </Button>
              )}
              {has(PERMISSIONS.APPOINTMENT_CREATE) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/appointments?patientId=${patient.id}`)}
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Book appointment
                </Button>
              )}
              {has(PERMISSIONS.DOCUMENT_UPLOAD) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/documents?patientId=${patient.id}`)}
                >
                  <FileUp className="h-4 w-4" aria-hidden="true" />
                  Upload document
                </Button>
              )}
            </div>
          </div>

          {patient.alerts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {patient.alerts.map((alert, i) => (
                <StatusPill key={`${alert.kind}-${i}`} label={alert.label} tone={alertTone(alert.severity)} />
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-secondary">Last visit</p>
              <p className="text-text-primary">{formatDateTime(patient.lastVisitAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Next appointment</p>
              <p className="text-text-primary">{formatDateTime(patient.nextAppointmentAt)}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Preferred language</p>
              <p className="text-text-primary">{patient.preferredLanguage ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Registered</p>
              <p className="text-text-primary">{formatDateTime(patient.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Medical Timeline</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="followups">Follow-Ups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab patient={patient} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="timeline">
          <ComingSoonTab
            icon={Activity}
            title="Medical timeline coming soon"
            description="A unified timeline of visits, assessments, and consultations will appear here once the clinical modules are connected."
          />
        </TabsContent>
        <TabsContent value="visits">
          <ComingSoonTab
            icon={CalendarClock}
            title="Visit history coming soon"
            description="Past and upcoming visits will appear here once the appointments and queue modules are connected."
          />
        </TabsContent>
        <TabsContent value="vitals">
          <ComingSoonTab
            icon={HeartPulse}
            title="Vitals coming soon"
            description="Recorded vitals will appear here once the vitals module is connected."
          />
        </TabsContent>
        <TabsContent value="prescriptions">
          <ComingSoonTab
            icon={Pill}
            title="Prescriptions coming soon"
            description="Prescriptions will appear here once the prescriptions module is connected."
          />
        </TabsContent>
        <TabsContent value="appointments">
          <ComingSoonTab
            icon={Stethoscope}
            title="Appointments coming soon"
            description="Scheduled and past appointments will appear here once the appointments module is connected."
          />
        </TabsContent>
        <TabsContent value="documents">
          <ComingSoonTab
            icon={FolderOpen}
            title="Documents coming soon"
            description="Uploaded reports and files will appear here once the documents module is connected."
          />
        </TabsContent>
        <TabsContent value="billing">
          <ComingSoonTab
            icon={Receipt}
            title="Billing coming soon"
            description="Invoices and payments will appear here once the billing module is connected."
          />
        </TabsContent>
        <TabsContent value="followups">
          <ComingSoonTab
            icon={Repeat}
            title="Follow-ups coming soon"
            description="Scheduled follow-ups will appear here once the clinical follow-up workflow is connected."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ patient, canEdit }: { patient: PatientProfileDto; canEdit: boolean }) {
  const updatePatient = useUpdatePatientMutation(patient.id);
  const [editing, setEditing] = useState(false);
  const [allergies, setAllergies] = useState(patient.allergies);
  const [conditions, setConditions] = useState(patient.conditions);
  const [currentMedicines, setCurrentMedicines] = useState(patient.currentMedicines);
  const [notes, setNotes] = useState(patient.notes ?? '');

  useEffect(() => {
    if (!editing) {
      setAllergies(patient.allergies);
      setConditions(patient.conditions);
      setCurrentMedicines(patient.currentMedicines);
      setNotes(patient.notes ?? '');
    }
  }, [patient, editing]);

  function cancelEdit() {
    setAllergies(patient.allergies);
    setConditions(patient.conditions);
    setCurrentMedicines(patient.currentMedicines);
    setNotes(patient.notes ?? '');
    setEditing(false);
  }

  async function saveEdit() {
    try {
      await updatePatient.mutateAsync({ allergies, conditions, currentMedicines, notes });
      toast.success('Patient record updated');
      setEditing(false);
    } catch (err) {
      toast.error('Could not save changes', apiErrorMessage(err));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardContent className="space-y-3 pt-5 text-sm">
          <h3 className="font-medium text-text-primary">Contact & identity</h3>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs text-text-secondary">Date of birth</dt>
              <dd className="text-text-primary">{patient.dateOfBirth ?? 'Not recorded'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Mobile</dt>
              <dd className="text-text-primary">{patient.mobile ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Alternate contact</dt>
              <dd className="text-text-primary">{patient.alternateContact ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Email</dt>
              <dd className="text-text-primary">{patient.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Address</dt>
              <dd className="text-text-primary">
                {[patient.addressLine, patient.city].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-secondary">Emergency contacts</dt>
              <dd className="text-text-primary">
                {patient.emergencyContacts.length > 0
                  ? patient.emergencyContacts.map((c) => `${c.name} (${c.phone})`).join(', ')
                  : '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 pt-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-text-primary">Clinical summary</h3>
            {canEdit &&
              (editing ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={updatePatient.isPending}>
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void saveEdit()} loading={updatePatient.isPending}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save changes
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Button>
              ))}
          </div>

          <TagListEditor
            label="Allergies"
            items={allergies}
            onChange={setAllergies}
            editable={editing}
            tone="danger"
            placeholder="e.g. Penicillin"
            emptyText="No known allergies recorded"
            maxLength={120}
          />
          <TagListEditor
            label="Conditions"
            items={conditions}
            onChange={setConditions}
            editable={editing}
            placeholder="e.g. Hypertension"
            emptyText="No conditions recorded"
            maxLength={120}
          />
          <TagListEditor
            label="Current medicines"
            items={currentMedicines}
            onChange={setCurrentMedicines}
            editable={editing}
            placeholder="e.g. Metformin 500mg"
            emptyText="No current medicines recorded"
            maxLength={160}
          />

          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-text-primary">
              Notes
            </label>
            {editing ? (
              <Textarea
                id="notes"
                rows={4}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {patient.notes || 'No notes recorded'}
              </p>
            )}
          </div>

          {!canEdit && (
            <p className="text-xs text-text-secondary">
              You have read-only access to this patient's clinical summary.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

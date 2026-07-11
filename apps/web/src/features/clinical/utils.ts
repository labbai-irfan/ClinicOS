import { format, parseISO } from 'date-fns';
import type { PatientAlertDto, QueueStatus } from '@clinicos/types';
import type { StatusTone } from '../../components/ui/StatusPill';

/** Human label + non-color-reliant tone for every queue status this feature might display. */
const QUEUE_STATUS_META: Record<QueueStatus, { label: string; tone: StatusTone }> = {
  scheduled: { label: 'Scheduled', tone: 'neutral' },
  arrival_pending: { label: 'Arrival Pending', tone: 'neutral' },
  checked_in: { label: 'Checked In', tone: 'info' },
  waiting_for_nurse: { label: 'Waiting for Nurse', tone: 'neutral' },
  nurse_assessment: { label: 'Nurse Assessment', tone: 'info' },
  ready_for_doctor: { label: 'Ready for Doctor', tone: 'info' },
  waiting_for_doctor: { label: 'Waiting for Doctor', tone: 'warning' },
  in_consultation: { label: 'In Consultation', tone: 'info' },
  consultation_completed: { label: 'Consultation Completed', tone: 'success' },
  billing_pending: { label: 'Billing Pending', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  temporarily_away: { label: 'Temporarily Away', tone: 'warning' },
  skipped: { label: 'Skipped', tone: 'danger' },
  rejoined: { label: 'Rejoined', tone: 'info' },
  delayed: { label: 'Delayed', tone: 'warning' },
  no_show: { label: 'No-Show', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function queueStatusLabel(status: QueueStatus): string {
  return QUEUE_STATUS_META[status].label;
}

export function queueStatusTone(status: QueueStatus): StatusTone {
  return QUEUE_STATUS_META[status].tone;
}

/** Alert severity never relies on color alone — StatusPill pairs this tone with an icon + text. */
export function alertTone(severity: PatientAlertDto['severity']): StatusTone {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export function genderLabel(gender: string): string {
  return gender.length > 0 ? gender.charAt(0).toUpperCase() + gender.slice(1) : gender;
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy, h:mm a');
  } catch {
    return '—';
  }
}

export function formatDateOnly(value?: string): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

/** Priority desc, then board position asc — matches the queue module's own ordering. */
export function sortQueueEntries<T extends { priority: number; position: number }>(a: T, b: T): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.position - b.position;
}

/** 0-10 scale grouped into clinically-common bands; always paired with the raw number. */
export function painLevelLabel(level: number): string {
  if (level === 0) return 'No pain';
  if (level <= 3) return 'Mild';
  if (level <= 6) return 'Moderate';
  if (level <= 9) return 'Severe';
  return 'Worst possible';
}

export interface VitalsValues {
  temperatureC?: number;
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  spo2Percent?: number;
  respiratoryRate?: number;
  heightCm?: number;
  weightKg?: number;
  bloodGlucoseMgDl?: number;
}

export function hasAnyVitalValue(values: VitalsValues): boolean {
  return Object.values(values).some((v) => v !== undefined && v !== null && !Number.isNaN(v));
}

/**
 * Client-side preview only — the backend (nurse-assessments/vitals service) always
 * recomputes BMI itself from the saved reading; this never gets sent to the API.
 */
export function computeClientBmi(heightCm?: number, weightKg?: number): number | undefined {
  if (!heightCm || !weightKg) return undefined;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

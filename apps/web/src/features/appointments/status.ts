import { APPOINTMENT_TRANSITIONS, type AppointmentStatus, type AppointmentType } from '@clinicos/types';
import type { StatusTone } from '../../components/ui';

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  arrival_pending: 'Arrival Pending',
  checked_in: 'Checked In',
  late: 'Late',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  no_show: 'No-Show',
};

/** Same five tones StatusPill supports — status is never conveyed by color alone (spec §21/§32). */
export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, StatusTone> = {
  scheduled: 'neutral',
  confirmed: 'info',
  arrival_pending: 'warning',
  checked_in: 'success',
  late: 'warning',
  completed: 'success',
  cancelled: 'danger',
  rescheduled: 'neutral',
  no_show: 'danger',
};

const TONE_SOLID_COLOR: Record<StatusTone, string> = {
  neutral: 'rgb(var(--text-secondary))',
  info: 'rgb(var(--info))',
  success: 'rgb(var(--success))',
  warning: 'rgb(var(--warning))',
  danger: 'rgb(var(--danger))',
};

const TONE_TINT_COLOR: Record<StatusTone, string> = {
  neutral: 'rgb(var(--surface-muted))',
  info: 'rgb(var(--info) / 0.16)',
  success: 'rgb(var(--success) / 0.16)',
  warning: 'rgb(var(--warning) / 0.16)',
  danger: 'rgb(var(--danger) / 0.16)',
};

/** Solid design-token color for a status (calendar event border) — sourced from the same
 *  CSS variables as StatusPill, never a raw hex value. */
export function appointmentStatusColor(status: AppointmentStatus): string {
  return TONE_SOLID_COLOR[APPOINTMENT_STATUS_TONE[status]];
}

/** Soft tint for a status (calendar event fill) so chip text stays legible in both themes. */
export function appointmentStatusTint(status: AppointmentStatus): string {
  return TONE_TINT_COLOR[APPOINTMENT_STATUS_TONE[status]];
}

export const APPOINTMENT_TYPE_LABEL: Record<AppointmentType, string> = {
  new: 'New Patient',
  follow_up: 'Follow-up',
  procedure: 'Procedure',
  review: 'Review',
};

/** Button label for a status transition target. */
const ACTION_LABEL: Partial<Record<AppointmentStatus, string>> = {
  confirmed: 'Confirm',
  arrival_pending: 'Mark Arrival Pending',
  checked_in: 'Check In',
  late: 'Mark Late',
  completed: 'Mark Completed',
  cancelled: 'Cancel',
  no_show: 'No-Show',
};

/**
 * Status-change quick actions available from `status`. `rescheduled` is excluded — it is only
 * ever produced by the dedicated reschedule flow, never picked directly from a status list.
 */
export function nextStatusActions(status: AppointmentStatus): Array<{ status: AppointmentStatus; label: string }> {
  return APPOINTMENT_TRANSITIONS[status]
    .filter((next) => next !== 'rescheduled')
    .map((next) => ({ status: next, label: ACTION_LABEL[next] ?? APPOINTMENT_STATUS_LABEL[next] }));
}

/** Sensitive status changes that always require a written reason (spec: audited actions). */
export const REASON_REQUIRED_STATUSES: readonly AppointmentStatus[] = ['cancelled', 'no_show'];

/** Statuses from which rescheduling still makes sense (before the patient has checked in). */
export const RESCHEDULABLE_STATUSES: readonly AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'arrival_pending',
  'late',
];

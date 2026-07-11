import type { AppointmentStatus, EmergencyStatus, QueueStatus } from './enums';

/**
 * Allowed queue transitions. Any transition not listed here must be rejected by the
 * queue service with ERROR_CODES.INVALID_TRANSITION. Terminal states have no exits.
 */
export const QUEUE_TRANSITIONS: Readonly<Record<QueueStatus, readonly QueueStatus[]>> = {
  scheduled: ['arrival_pending', 'checked_in', 'no_show', 'cancelled'],
  arrival_pending: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['waiting_for_nurse', 'ready_for_doctor', 'temporarily_away', 'cancelled', 'no_show'],
  waiting_for_nurse: ['nurse_assessment', 'temporarily_away', 'skipped', 'cancelled', 'no_show'],
  nurse_assessment: ['ready_for_doctor', 'waiting_for_nurse', 'temporarily_away', 'cancelled'],
  ready_for_doctor: ['waiting_for_doctor', 'in_consultation', 'temporarily_away', 'skipped', 'cancelled', 'no_show'],
  waiting_for_doctor: ['in_consultation', 'temporarily_away', 'skipped', 'cancelled', 'no_show'],
  in_consultation: ['consultation_completed', 'waiting_for_doctor'],
  consultation_completed: ['billing_pending', 'completed'],
  billing_pending: ['completed', 'cancelled'],
  completed: [],
  temporarily_away: ['rejoined', 'no_show', 'cancelled'],
  skipped: ['rejoined', 'no_show', 'cancelled'],
  rejoined: ['waiting_for_nurse', 'ready_for_doctor', 'waiting_for_doctor', 'cancelled', 'no_show'],
  delayed: ['waiting_for_doctor', 'in_consultation', 'cancelled', 'no_show'],
  no_show: [],
  cancelled: [],
};

export function canTransitionQueue(from: QueueStatus, to: QueueStatus): boolean {
  return QUEUE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Queue statuses that count as "active & ahead of you" for waiting-time estimation. */
export const QUEUE_ACTIVE_STATUSES: readonly QueueStatus[] = [
  'checked_in',
  'waiting_for_nurse',
  'nurse_assessment',
  'ready_for_doctor',
  'waiting_for_doctor',
  'rejoined',
  'delayed',
];

/** Transitions that always require a reason + permission + audit entry. */
export const QUEUE_AUDITED_ACTIONS = [
  'skip',
  'rejoin',
  'reorder',
  'transfer_doctor',
  'no_show',
  'cancel',
  'priority_change',
] as const;
export type QueueAuditedAction = (typeof QUEUE_AUDITED_ACTIONS)[number];

export const EMERGENCY_TRANSITIONS: Readonly<Record<EmergencyStatus, readonly EmergencyStatus[]>> =
  {
    awaiting_triage: ['triage_in_progress', 'closed'],
    triage_in_progress: ['doctor_alerted', 'under_assessment', 'closed'],
    doctor_alerted: ['doctor_responding', 'under_assessment'],
    doctor_responding: ['under_assessment'],
    under_assessment: ['treatment_in_progress', 'under_observation', 'referral_required', 'discharged'],
    treatment_in_progress: ['under_observation', 'referral_required', 'discharged'],
    under_observation: ['treatment_in_progress', 'referral_required', 'discharged'],
    referral_required: ['transfer_arranging', 'under_observation', 'discharged'],
    transfer_arranging: ['transferred', 'under_observation'],
    transferred: ['closed'],
    discharged: ['follow_up_required', 'closed'],
    follow_up_required: ['closed'],
    closed: [],
  };

export function canTransitionEmergency(from: EmergencyStatus, to: EmergencyStatus): boolean {
  return EMERGENCY_TRANSITIONS[from]?.includes(to) ?? false;
}

export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  scheduled: ['confirmed', 'arrival_pending', 'checked_in', 'cancelled', 'rescheduled', 'no_show', 'late'],
  confirmed: ['arrival_pending', 'checked_in', 'cancelled', 'rescheduled', 'no_show', 'late'],
  arrival_pending: ['checked_in', 'late', 'no_show', 'cancelled'],
  late: ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  rescheduled: [],
  no_show: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return APPOINTMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

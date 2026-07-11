import { QUEUE_BOARD_COLUMNS } from '@clinicos/types';
import type { QueueEntrySource, QueueStatus, RejoinPolicy } from '@clinicos/types';
import type { StatusTone } from '../../components/ui/StatusPill';

export type QueueBoardColumn = (typeof QUEUE_BOARD_COLUMNS)[number];

/** Human-readable label for every queue status (board columns + side-branch states). */
export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  scheduled: 'Scheduled',
  arrival_pending: 'Arrival Pending',
  checked_in: 'Checked In',
  waiting_for_nurse: 'Waiting for Nurse',
  nurse_assessment: 'Nurse Assessment',
  ready_for_doctor: 'Ready for Doctor',
  waiting_for_doctor: 'Waiting for Doctor',
  in_consultation: 'In Consultation',
  consultation_completed: 'Consultation Completed',
  billing_pending: 'Billing Pending',
  completed: 'Completed',
  temporarily_away: 'Temporarily Away',
  skipped: 'Skipped',
  rejoined: 'Rejoined',
  delayed: 'Delayed',
  no_show: 'No-Show',
  cancelled: 'Cancelled',
};

/** StatusPill tone never relies on color alone — icon + text always pair (spec §21/§32). */
export const QUEUE_STATUS_TONE: Record<QueueStatus, StatusTone> = {
  scheduled: 'neutral',
  arrival_pending: 'neutral',
  checked_in: 'info',
  waiting_for_nurse: 'neutral',
  nurse_assessment: 'info',
  ready_for_doctor: 'info',
  waiting_for_doctor: 'warning',
  in_consultation: 'info',
  consultation_completed: 'success',
  billing_pending: 'warning',
  completed: 'success',
  temporarily_away: 'warning',
  skipped: 'danger',
  rejoined: 'info',
  delayed: 'warning',
  no_show: 'danger',
  cancelled: 'danger',
};

export const QUEUE_SOURCE_LABELS: Record<QueueEntrySource, string> = {
  appointment: 'Appointment',
  walk_in: 'Walk-in',
  quick_entry: 'Quick Entry',
  follow_up: 'Follow-up',
  emergency: 'Emergency',
  phone_booking: 'Phone Booking',
};

export const REJOIN_POLICY_LABELS: Record<RejoinPolicy, string> = {
  after_next_patient: 'After next patient',
  after_two_patients: 'After two patients',
  end_of_priority_group: 'End of priority group',
  manual: 'Manual position (override)',
};

export const QUEUE_BOARD_COLUMN_LABELS: Record<QueueBoardColumn, string> = {
  waiting_for_nurse: 'Waiting for Nurse',
  nurse_assessment: 'Nurse Assessment',
  ready_for_doctor: 'Ready for Doctor',
  waiting_for_doctor: 'Waiting for Doctor',
  in_consultation: 'In Consultation',
  billing_pending: 'Billing Pending',
  completed: 'Completed',
};

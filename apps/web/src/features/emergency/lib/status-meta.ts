import { differenceInSeconds } from 'date-fns';
import type { ArrivalMode, EmergencyPriority, EmergencyStatus, Gender } from '@clinicos/types';
import type { StatusTone } from '../../../components/ui/StatusPill';

export const PRIORITY_LABELS: Record<EmergencyPriority, string> = {
  critical: 'Critical',
  urgent: 'Urgent',
  standard: 'Standard',
  unconfirmed: 'Unconfirmed',
};

/**
 * Priority uses danger/warning tones intentionally (spec §18) — this is the ONE place
 * red should draw the eye. Everything else on the board stays calm and neutral.
 */
export const PRIORITY_TONES: Record<EmergencyPriority, StatusTone> = {
  critical: 'danger',
  urgent: 'warning',
  standard: 'info',
  unconfirmed: 'neutral',
};

export const STATUS_LABELS: Record<EmergencyStatus, string> = {
  awaiting_triage: 'Awaiting triage',
  triage_in_progress: 'Triage in progress',
  doctor_alerted: 'Doctor alerted',
  doctor_responding: 'Doctor responding',
  under_assessment: 'Under assessment',
  treatment_in_progress: 'Treatment in progress',
  under_observation: 'Under observation',
  referral_required: 'Referral required',
  transfer_arranging: 'Arranging transfer',
  transferred: 'Transferred',
  discharged: 'Discharged',
  follow_up_required: 'Follow-up required',
  closed: 'Closed',
};

export const STATUS_TONES: Record<EmergencyStatus, StatusTone> = {
  awaiting_triage: 'warning',
  triage_in_progress: 'warning',
  doctor_alerted: 'danger',
  doctor_responding: 'danger',
  under_assessment: 'info',
  treatment_in_progress: 'info',
  under_observation: 'info',
  referral_required: 'warning',
  transfer_arranging: 'warning',
  transferred: 'neutral',
  discharged: 'success',
  follow_up_required: 'info',
  closed: 'neutral',
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Unknown',
};

export const ARRIVAL_MODE_LABELS: Record<ArrivalMode, string> = {
  walk_in: 'Walk-in',
  family_vehicle: 'Family vehicle',
  ambulance: 'Ambulance',
  police: 'Police',
  referred: 'Referred',
  other: 'Other',
};

/** Compact "elapsed since arrival" string, e.g. "45s", "12m", "1h 05m". */
export function formatElapsed(fromIso: string, now: Date): string {
  const totalSeconds = Math.max(0, differenceInSeconds(now, new Date(fromIso)));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (totalMinutes > 0) return `${totalMinutes}m`;
  return `${totalSeconds}s`;
}

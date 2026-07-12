import type { RejoinPolicy } from '@clinicos/types';
import type { AddressContactInput, ClinicIdentityInput, WorkingHoursFormInput } from './schemas';

/** Accumulates what has been saved in this session so step 9 can show a real summary
 *  without re-fetching resources that have no GET contract in this task (branch working
 *  hours, clinic settings). Persisted server-side truth still lives behind each step's
 *  own mutation — this is presentation-only. */
export interface WizardSummary {
  identity?: ClinicIdentityInput;
  address?: AddressContactInput;
  workingHours?: WorkingHoursFormInput['workingHours'];
  doctorsInvited?: number;
  consultationFeePaise?: number;
  appointmentWindowMinutes?: number;
  appointmentBufferMinutes?: number;
  rejoinPolicy?: RejoinPolicy;
  prescriptionHeader?: string;
  prescriptionFooter?: string;
  staffInvited?: number;
}

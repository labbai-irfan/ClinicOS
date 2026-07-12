import { z } from 'zod';
import { ROLE_KEYS, WEEKDAYS } from '@clinicos/types';
import { nonEmptyText, objectId, optionalMobileNumber, optionalText, timeHHmm } from './common';

export const workingHoursSchema = z.array(
  z.object({
    day: z.enum(WEEKDAYS),
    open: timeHHmm,
    close: timeHHmm,
    closed: z.boolean().default(false),
  }),
);

/**
 * True when `Intl` can construct a `DateTimeFormat` for the given zone. Node's ICU
 * throws `RangeError` for anything that is not a valid IANA identifier — the exact
 * check `shared/dates.ts` relies on at slot-computation time, so an invalid value
 * must never reach the database.
 */
function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const clinicIdentitySchema = z.object({
  name: nonEmptyText(160),
  phone: optionalMobileNumber,
  email: z.string().trim().toLowerCase().email().optional(),
  timezone: z.string().default('Asia/Kolkata').refine(isValidIanaTimezone, 'Enter a valid IANA timezone (e.g. Asia/Kolkata).'),
});

export const branchSchema = z.object({
  name: nonEmptyText(160),
  addressLine1: optionalText(240),
  addressLine2: optionalText(240),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(12),
  phone: optionalMobileNumber,
  workingHours: workingHoursSchema.optional(),
});

export const inviteStaffSchema = z.object({
  name: nonEmptyText(120),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalMobileNumber,
  roleKey: z.enum(ROLE_KEYS).exclude(['super_admin', 'patient']),
  branchIds: z.array(objectId).min(1, 'Assign at least one branch'),
  specialization: optionalText(120),
  qualification: optionalText(160),
  registrationNumber: optionalText(80),
  consultationFeePaise: z.number().int().min(0).optional(),
  followUpFeePaise: z.number().int().min(0).optional(),
  temporaryPassword: z.string().min(8).max(128).optional(),
});
export type InviteStaffInput = z.infer<typeof inviteStaffSchema>;

export const doctorScheduleSchema = z.object({
  doctorId: objectId,
  branchId: objectId,
  weekly: z.array(
    z.object({
      day: z.enum(WEEKDAYS),
      sessions: z.array(z.object({ start: timeHHmm, end: timeHHmm })).max(4),
    }),
  ),
  slotMinutes: z.number().int().min(5).max(120).default(20),
  bufferMinutes: z.number().int().min(0).max(60).default(5),
  maxPerWindow: z.number().int().min(1).max(30).default(4),
  walkInCapacityPerDay: z.number().int().min(0).max(500).default(50),
});
export type DoctorScheduleInput = z.infer<typeof doctorScheduleSchema>;

export const doctorLeaveSchema = z.object({
  doctorId: objectId,
  branchId: objectId.optional(),
  from: z.string(),
  to: z.string(),
  reason: optionalText(300),
});

export const tokenSettingsSchema = z.object({
  branchId: objectId,
  mode: z.enum(['branch', 'doctor', 'department']).default('branch'),
  prefix: z.string().trim().min(1).max(6).default('A'),
  pad: z.number().int().min(2).max(5).default(3),
  dailyReset: z.boolean().default(true),
});
export type TokenSettingsInput = z.infer<typeof tokenSettingsSchema>;

export const rejoinPolicySchema = z.enum([
  'after_next_patient',
  'after_two_patients',
  'end_of_priority_group',
  'manual',
]);

/** Clinic-wide scheduling/queue/prescription defaults (spec §8 onboarding step 6, §14). */
export const updateClinicSettingsSchema = z.object({
  appointmentWindowMinutes: z.number().int().min(5).max(180).optional(),
  appointmentBufferMinutes: z.number().int().min(0).max(60).optional(),
  rejoinPolicy: rejoinPolicySchema.optional(),
  walkInCapacityPerDay: z.number().int().min(0).max(500).optional(),
  prescriptionShowDiagnosisDefault: z.boolean().optional(),
});
export type UpdateClinicSettingsInput = z.infer<typeof updateClinicSettingsSchema>;

export const tokenSettingsQuery = z.object({
  branchId: objectId,
});

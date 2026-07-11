import { z } from 'zod';
import { ARRIVAL_MODES, EMERGENCY_PRIORITIES, EMERGENCY_STATUSES, GENDERS } from '@clinicos/types';
import { mobileNumber, nonEmptyText, objectId, optionalText } from './common';

/** Emergency quick entry — identity may be unknown; only the minimum is required. */
export const createEmergencySchema = z.object({
  patientId: objectId.optional(),
  name: optionalText(160),
  approximateAge: z.number().int().min(0).max(130).optional(),
  gender: z.enum(GENDERS).default('unknown'),
  arrivalMode: z.enum(ARRIVAL_MODES).default('walk_in'),
  mainConcern: nonEmptyText(500),
  mobile: mobileNumber.optional(),
  address: optionalText(300),
  emergencyContact: optionalText(160),
  arrivalAt: z.string().optional(),
});
export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;

export const emergencyTriageSchema = z.object({
  priority: z.enum(EMERGENCY_PRIORITIES),
  notes: optionalText(2000),
});

export const emergencyTransitionSchema = z.object({
  to: z.enum(EMERGENCY_STATUSES),
  notes: optionalText(1000),
});

export const emergencyAssignSchema = z.object({
  doctorId: objectId.optional(),
  nurseId: objectId.optional(),
});

export const emergencyReferralSchema = z.object({
  facilityName: nonEmptyText(200),
  reason: nonEmptyText(500),
  notes: optionalText(2000),
  transportMode: optionalText(80),
});

export const emergencyObservationSchema = z.object({
  note: nonEmptyText(2000),
});

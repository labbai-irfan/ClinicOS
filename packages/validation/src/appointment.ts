import { z } from 'zod';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '@clinicos/types';
import { localDate, nonEmptyText, objectId, optionalText, timeHHmm } from './common';

export const createAppointmentSchema = z.object({
  patientId: objectId,
  doctorId: objectId,
  branchId: objectId.optional(),
  date: localDate,
  windowStart: timeHHmm,
  windowEnd: timeHHmm,
  type: z.enum(APPOINTMENT_TYPES).default('new'),
  reason: optionalText(300),
  internalNotes: optionalText(1000),
  patientNotes: optionalText(500),
  overrideCapacity: z.boolean().default(false),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  date: localDate,
  windowStart: timeHHmm,
  windowEnd: timeHHmm,
  reason: nonEmptyText(500),
  overrideCapacity: z.boolean().default(false),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
  reason: optionalText(500),
});

export const appointmentListQuery = z.object({
  date: localDate.optional(),
  from: localDate.optional(),
  to: localDate.optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
});

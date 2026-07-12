import { z } from 'zod';
import { doctorLeaveSchema } from './tenancy';
import { localDate, objectId } from './common';

// Schedule module schemas. The shared write schemas (doctorScheduleSchema,
// doctorLeaveSchema) live in ./tenancy — this file only adds the schedule
// module's read/query shapes.

export type DoctorLeaveInput = z.infer<typeof doctorLeaveSchema>;

/** GET /schedules — one doctor+branch weekly schedule (both ids) or a filtered list. */
export const doctorScheduleQuery = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
});
export type DoctorScheduleQuery = z.infer<typeof doctorScheduleQuery>;

/** GET /schedules/available-slots — bookable slot grid for a doctor on one local date. */
export const availableSlotsQuery = z.object({
  doctorId: objectId,
  date: localDate,
  branchId: objectId.optional(),
});
export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuery>;

/** GET /schedules/leaves — list doctor leaves, optionally narrowed to one branch. */
export const doctorLeaveListQuery = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
});
export type DoctorLeaveListQuery = z.infer<typeof doctorLeaveListQuery>;

import { Schema, model, type Types } from 'mongoose';
import { WEEKDAYS, type Weekday } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

export interface ScheduleSession {
  /** Local wall-clock time HH:mm (clinic timezone). */
  start: string;
  end: string;
}

export interface ScheduleWeekdayEntry {
  day: Weekday;
  sessions: ScheduleSession[];
}

/**
 * One weekly availability template per doctor per branch (spec §13). Times are
 * local HH:mm strings interpreted in the clinic timezone; slot/buffer/capacity
 * settings drive the available-slots computation used by appointment booking.
 */
export interface DoctorScheduleDoc extends TenantFields {
  _id: Types.ObjectId;
  doctorId: Types.ObjectId;
  weekly: ScheduleWeekdayEntry[];
  slotMinutes: number;
  bufferMinutes: number;
  maxPerWindow: number;
  walkInCapacityPerDay: number;
}

const sessionSchema = new Schema<ScheduleSession>(
  {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  { _id: false },
);

const weekdayEntrySchema = new Schema<ScheduleWeekdayEntry>(
  {
    day: { type: String, required: true, enum: WEEKDAYS },
    sessions: { type: [sessionSchema], default: [] },
  },
  { _id: false },
);

const doctorScheduleSchema = new Schema<DoctorScheduleDoc>(
  {
    doctorId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    weekly: { type: [weekdayEntrySchema], default: [] },
    slotMinutes: { type: Number, required: true, default: 20 },
    bufferMinutes: { type: Number, required: true, default: 5 },
    maxPerWindow: { type: Number, required: true, default: 4 },
    walkInCapacityPerDay: { type: Number, required: true, default: 50 },
  },
  { collection: 'doctorSchedules' },
);

tenantBase(doctorScheduleSchema);

// Doctor+branch lookup is the hot path (admin editor and slot computation). Unique so
// two concurrent upserts (double-click, two admin tabs) can never create duplicate
// schedule documents for the same doctor+branch — schedule.service canonicalizes
// `doctorId` to the user id before writing so the dual staff-profile-id/user-id
// representation can't slip past this constraint either.
doctorScheduleSchema.index({ clinicId: 1, branchId: 1, doctorId: 1 }, { unique: true });

/** Primary export for this file (canonical model registry). */
export const DoctorScheduleModel = model<DoctorScheduleDoc>('DoctorSchedule', doctorScheduleSchema);

/**
 * A doctor leave blocks availability for a local-date range (inclusive). A leave
 * without a branchId is clinic-wide and applies to every branch the doctor works at.
 * Soft-deleted via `deletedAt` — never hard-deleted.
 */
export interface DoctorLeaveDoc extends TenantFields {
  _id: Types.ObjectId;
  doctorId: Types.ObjectId;
  /** Local calendar dates (clinic timezone), YYYY-MM-DD, inclusive range. */
  from: string;
  to: string;
  reason?: string;
}

const doctorLeaveSchema = new Schema<DoctorLeaveDoc>(
  {
    doctorId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    reason: { type: String, trim: true },
  },
  { collection: 'doctorLeaves' },
);

tenantBase(doctorLeaveSchema);

doctorLeaveSchema.index({ clinicId: 1, doctorId: 1, from: 1 });

export const DoctorLeaveModel = model<DoctorLeaveDoc>('DoctorLeave', doctorLeaveSchema);

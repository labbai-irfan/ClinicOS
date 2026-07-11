import { Schema, model, type Types } from 'mongoose';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, type AppointmentStatus, type AppointmentType } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

export interface AppointmentDoc extends TenantFields {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  /** Local calendar date (clinic timezone), YYYY-MM-DD. */
  date: string;
  /** UTC instants computed via localDateTimeToUtc(tenant.timezone, date, time). */
  windowStart: Date;
  windowEnd: Date;
  type: AppointmentType;
  reason?: string;
  internalNotes?: string;
  patientNotes?: string;
  status: AppointmentStatus;
}

const appointmentSchema = new Schema<AppointmentDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, ref: 'Patient', index: true },
    doctorId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    date: { type: String, required: true },
    windowStart: { type: Date, required: true },
    windowEnd: { type: Date, required: true },
    type: { type: String, enum: APPOINTMENT_TYPES, required: true, default: 'new' },
    reason: String,
    internalNotes: String,
    patientNotes: String,
    status: { type: String, enum: APPOINTMENT_STATUSES, required: true, default: 'scheduled', index: true },
  },
  { collection: 'appointments' },
);

tenantBase(appointmentSchema);

// Doctor-day lookups (capacity/overlap checks, day schedules) are the hot path.
appointmentSchema.index({ clinicId: 1, branchId: 1, doctorId: 1, date: 1 });

export const AppointmentModel = model<AppointmentDoc>('Appointment', appointmentSchema);

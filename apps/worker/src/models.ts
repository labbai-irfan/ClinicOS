import { Schema, model, Types } from 'mongoose';

/**
 * Minimal, read-only mirrors of collections owned by apps/api's Mongoose models.
 * `strict: false` + no field validators — the worker only ever reads a handful of
 * fields per job and must never be the source of truth for these schemas. Do not
 * add write logic against these beyond MessageLogModel, which the worker owns.
 *
 * No `models.X || model(...)` re-registration guard: `tsx watch` restarts the whole
 * process on file change rather than hot-reloading modules in place, so mongoose's
 * model registry is never populated twice within one process lifetime here (and that
 * guard's `Model<any> | Model<T>` union type breaks every query method's overloads).
 */

export interface AppointmentRead {
  _id: Types.ObjectId;
  clinicId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  date: string;
  windowStart: Date;
  windowEnd: Date;
  status: string;
  deletedAt?: Date | null;
}
const appointmentSchema = new Schema<AppointmentRead>({}, { collection: 'appointments', strict: false });
export const AppointmentModel = model<AppointmentRead>('WorkerAppointment', appointmentSchema, 'appointments');

export interface PatientRead {
  _id: Types.ObjectId;
  fullName: string;
  mobile?: string;
}
const patientSchema = new Schema<PatientRead>({}, { collection: 'patients', strict: false });
export const PatientModel = model<PatientRead>('WorkerPatient', patientSchema, 'patients');

export interface ClinicRead {
  _id: Types.ObjectId;
  name: string;
  timezone: string;
}
const clinicSchema = new Schema<ClinicRead>({}, { collection: 'clinics', strict: false });
export const ClinicModel = model<ClinicRead>('WorkerClinic', clinicSchema, 'clinics');

export interface UserRead {
  _id: Types.ObjectId;
  name: string;
}
const userSchema = new Schema<UserRead>({}, { collection: 'users', strict: false });
export const UserModel = model<UserRead>('WorkerUser', userSchema, 'users');

/**
 * Appointment.doctorId is stored as whichever id form the booking caller used — the
 * staff profile's own _id or the underlying user's _id (see
 * apps/api/src/modules/schedules/schedule.service.ts's expandDoctorIds, which resolves
 * the same ambiguity for schedule matching). The reminder handler needs this to look up
 * the doctor's display name regardless of which form was stored.
 */
export interface StaffProfileRead {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
}
const staffProfileSchema = new Schema<StaffProfileRead>({}, { collection: 'staffprofiles', strict: false });
export const StaffProfileModel = model<StaffProfileRead>('WorkerStaffProfile', staffProfileSchema, 'staffprofiles');

/** Owned by the worker — an audit trail of every SMS/WhatsApp send attempt. */
export interface MessageLogDoc {
  _id: Types.ObjectId;
  clinicId: Types.ObjectId;
  appointmentId: Types.ObjectId;
  patientId: Types.ObjectId;
  channel: 'sms' | 'whatsapp';
  to: string;
  body: string;
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string;
  error?: string;
  createdAt: Date;
}
const messageLogSchema = new Schema<MessageLogDoc>(
  {
    clinicId: { type: Schema.Types.ObjectId, required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, required: true },
    channel: { type: String, enum: ['sms', 'whatsapp'], required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    providerMessageId: String,
    error: String,
  },
  { collection: 'messageLogs', timestamps: { createdAt: true, updatedAt: false } },
);
export const MessageLogModel = model<MessageLogDoc>('MessageLog', messageLogSchema);

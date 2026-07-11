import { Schema, model, type Types } from 'mongoose';
import { GENDERS, type Gender } from '@clinicos/types';
import { tenantBase } from '../../database/plugins';

export interface PatientEmergencyContact {
  name: string;
  relation?: string;
  phone: string;
}

/**
 * Patients belong to the clinic (organizationId + clinicId), not to a single branch —
 * a patient can be seen across any branch of the clinic, so this model uses
 * `tenantBase(schema, { branch: false })`.
 */
export interface PatientDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  code: string;
  fullName: string;
  gender: Gender;
  dateOfBirth?: Date;
  approximateAge?: number;
  mobile?: string;
  alternateContact?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  preferredLanguage?: string;
  emergencyContacts: PatientEmergencyContact[];
  allergies: string[];
  conditions: string[];
  currentMedicines: string[];
  notes?: string;
  isTemporary: boolean;
  /** Set when this record was merged away into another (primary) patient record. */
  mergedIntoPatientId?: Types.ObjectId | null;
  lastVisitAt?: Date;
  nextAppointmentAt?: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const emergencyContactSchema = new Schema<PatientEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    relation: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const patientSchema = new Schema<PatientDoc>(
  {
    code: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    gender: { type: String, required: true, enum: GENDERS },
    dateOfBirth: { type: Date },
    approximateAge: { type: Number },
    mobile: { type: String, trim: true },
    alternateContact: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine: { type: String, trim: true },
    city: { type: String, trim: true },
    preferredLanguage: { type: String, trim: true },
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    allergies: { type: [String], default: [] },
    conditions: { type: [String], default: [] },
    currentMedicines: { type: [String], default: [] },
    notes: { type: String, trim: true },
    isTemporary: { type: Boolean, default: false },
    mergedIntoPatientId: { type: Schema.Types.ObjectId, default: null, index: true },
    lastVisitAt: { type: Date },
    nextAppointmentAt: { type: Date },
  },
  { collection: 'patients' },
);

tenantBase(patientSchema, { branch: false });

patientSchema.index({ clinicId: 1, code: 1 }, { unique: true });
patientSchema.index({ clinicId: 1, fullName: 1 });
patientSchema.index({ clinicId: 1, mobile: 1 });

export const PatientModel = model<PatientDoc>('Patient', patientSchema);

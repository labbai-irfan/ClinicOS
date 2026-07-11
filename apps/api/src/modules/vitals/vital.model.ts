import { Schema, model, Types } from 'mongoose';
import { tenantBase } from '../../database/plugins';

/**
 * A single vitals capture (spec §21): temperature, BP, pulse, SpO2, respiratory rate,
 * height, weight, BMI, blood glucose. Linked to a queue visit and/or an emergency case,
 * and always to a patient, so it can be plotted as a trend on the patient profile and
 * surfaced on the doctor consultation view.
 */
export interface VitalRecordDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId?: Types.ObjectId;
  patientId: Types.ObjectId;
  queueEntryId?: Types.ObjectId;
  emergencyCaseId?: Types.ObjectId;
  temperatureC?: number;
  systolic?: number;
  diastolic?: number;
  pulseBpm?: number;
  spo2Percent?: number;
  respiratoryRate?: number;
  heightCm?: number;
  weightKg?: number;
  /** Computed server-side from heightCm/weightKg — never trust a client-sent value. */
  bmi?: number;
  bloodGlucoseMgDl?: number;
  recordedByUserId?: Types.ObjectId;
  recordedByName?: string;
  recordedAt: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vitalRecordSchema = new Schema<VitalRecordDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    queueEntryId: { type: Schema.Types.ObjectId, index: true },
    emergencyCaseId: { type: Schema.Types.ObjectId, index: true },
    temperatureC: Number,
    systolic: Number,
    diastolic: Number,
    pulseBpm: Number,
    spo2Percent: Number,
    respiratoryRate: Number,
    heightCm: Number,
    weightKg: Number,
    bmi: Number,
    bloodGlucoseMgDl: Number,
    recordedByUserId: { type: Schema.Types.ObjectId },
    recordedByName: String,
    recordedAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'vitalRecords' },
);

tenantBase(vitalRecordSchema);

vitalRecordSchema.index({ clinicId: 1, patientId: 1, recordedAt: -1 });
vitalRecordSchema.index({ clinicId: 1, queueEntryId: 1, recordedAt: -1 });
vitalRecordSchema.index({ clinicId: 1, emergencyCaseId: 1, recordedAt: -1 });

export const VitalRecordModel = model<VitalRecordDoc>('VitalRecord', vitalRecordSchema);

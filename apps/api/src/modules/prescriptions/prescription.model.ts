import { Schema, model, type Types } from 'mongoose';
import { PRESCRIPTION_STATUSES, type PrescriptionStatus } from '@clinicos/types';
import { tenantBase } from '../../database/plugins';

/**
 * A doctor's prescription for a consultation (spec §23). Prescriptions are immutable
 * once `status` is `finalized`: revising a finalized prescription never edits it in
 * place — the old document is marked `superseded` and a brand new document is created
 * with `versionNumber` bumped (ADR-12). `status: 'draft'` documents are freely
 * upserted via autosave until the doctor finalizes.
 */
export interface PrescriptionItem {
  medicineName: string;
  genericName?: string;
  form?: string;
  strength?: string;
  dose: string;
  route?: string;
  frequency: string;
  durationDays?: number;
  timing?: string;
  foodRelation?: 'before_food' | 'after_food' | 'with_food' | 'any';
  instruction?: string;
}

export interface PrescriptionDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId?: Types.ObjectId;
  consultationId: Types.ObjectId;
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  items: PrescriptionItem[];
  advice?: string;
  testsRecommended: string[];
  followUpAt?: Date;
  includeDiagnosis: boolean;
  status: PrescriptionStatus;
  versionNumber: number;
  verificationCode?: string;
  finalizedAt?: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const prescriptionItemSchema = new Schema<PrescriptionItem>(
  {
    medicineName: { type: String, required: true, trim: true },
    genericName: { type: String, trim: true },
    form: { type: String, trim: true },
    strength: { type: String, trim: true },
    dose: { type: String, required: true, trim: true },
    route: { type: String, trim: true },
    frequency: { type: String, required: true, trim: true },
    durationDays: { type: Number },
    timing: { type: String, trim: true },
    foodRelation: { type: String, enum: ['before_food', 'after_food', 'with_food', 'any'] },
    instruction: { type: String, trim: true },
  },
  { _id: false },
);

const prescriptionSchema = new Schema<PrescriptionDoc>(
  {
    consultationId: { type: Schema.Types.ObjectId, required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    doctorId: { type: Schema.Types.ObjectId, required: true, index: true },
    items: { type: [prescriptionItemSchema], default: [] },
    advice: { type: String, trim: true },
    testsRecommended: { type: [String], default: [] },
    followUpAt: { type: Date },
    includeDiagnosis: { type: Boolean, default: false },
    status: {
      type: String,
      enum: PRESCRIPTION_STATUSES,
      default: 'draft',
      index: true,
    },
    versionNumber: { type: Number, default: 1 },
    verificationCode: { type: String },
    finalizedAt: { type: Date },
  },
  { collection: 'prescriptions' },
);

tenantBase(prescriptionSchema);

prescriptionSchema.index({ clinicId: 1, consultationId: 1, status: 1 });
prescriptionSchema.index({ clinicId: 1, consultationId: 1, versionNumber: -1 });
prescriptionSchema.index({ clinicId: 1, patientId: 1, createdAt: -1 });

export const PrescriptionModel = model<PrescriptionDoc>('Prescription', prescriptionSchema);

import { Schema, model, type Types } from 'mongoose';
import { CONSULTATION_STATUSES, type ConsultationStatus } from '@clinicos/types';
import { tenantBase } from '../../database/plugins';

/**
 * A doctor's consultation record for a patient (spec §22, three-region doctor
 * workspace). Once `status` reaches `completed` the clinical fields are frozen —
 * further changes must go through the amendment endpoint (consultation.service.ts),
 * which appends a ConsultationAmendmentModel entry and bumps `version`.
 */
export interface ConsultationDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId?: Types.ObjectId;
  patientId: Types.ObjectId;
  queueEntryId?: Types.ObjectId;
  doctorId: Types.ObjectId;
  symptoms?: string;
  examinationFindings?: string;
  clinicalNotes?: string;
  diagnosis: string[];
  treatmentPlan?: string;
  advice?: string;
  testsOrdered: string[];
  followUpAt?: Date;
  status: ConsultationStatus;
  startedAt: Date;
  completedAt?: Date;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const consultationSchema = new Schema<ConsultationDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    queueEntryId: { type: Schema.Types.ObjectId, index: true },
    doctorId: { type: Schema.Types.ObjectId, required: true, index: true },
    symptoms: String,
    examinationFindings: String,
    clinicalNotes: String,
    diagnosis: { type: [String], default: [] },
    treatmentPlan: String,
    advice: String,
    testsOrdered: { type: [String], default: [] },
    followUpAt: Date,
    status: {
      type: String,
      enum: CONSULTATION_STATUSES,
      default: 'draft',
      index: true,
    },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: Date,
    version: { type: Number, default: 0 },
  },
  { collection: 'consultations' },
);

tenantBase(consultationSchema);
consultationSchema.index({ clinicId: 1, branchId: 1, queueEntryId: 1 });
consultationSchema.index({ clinicId: 1, patientId: 1, startedAt: -1 });

export const ConsultationModel = model<ConsultationDoc>('Consultation', consultationSchema);

import { Schema, model, type Types } from 'mongoose';
import { tenantBase, type TenantFields } from '../../database/plugins';

export type NurseAssessmentStatus = 'draft' | 'completed';

export interface NurseAssessmentDoc extends TenantFields {
  _id: Types.ObjectId;
  patientId: Types.ObjectId;
  queueEntryId: Types.ObjectId;
  chiefComplaint: string;
  symptoms: string[];
  durationText?: string;
  painLevel?: number;
  relevantHistory?: string;
  allergies: string[];
  conditions: string[];
  currentMedicines: string[];
  previousTreatment?: string;
  nurseNotes?: string;
  status: NurseAssessmentStatus;
  startedAt: Date;
  completedAt?: Date;
}

const nurseAssessmentSchema = new Schema<NurseAssessmentDoc>(
  {
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    queueEntryId: { type: Schema.Types.ObjectId, required: true, index: true },
    chiefComplaint: { type: String, required: true, trim: true },
    symptoms: { type: [String], default: [] },
    durationText: String,
    painLevel: Number,
    relevantHistory: String,
    allergies: { type: [String], default: [] },
    conditions: { type: [String], default: [] },
    currentMedicines: { type: [String], default: [] },
    previousTreatment: String,
    nurseNotes: String,
    status: { type: String, enum: ['draft', 'completed'], required: true, default: 'draft' },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: Date,
  },
  { collection: 'nurse_assessments' },
);

nurseAssessmentSchema.plugin(tenantBase);

// One draft/completed assessment per queue entry per clinic — the autosave endpoint
// upserts on this key instead of creating duplicate rows. Partial on deletedAt so a
// soft-deleted record does not block a fresh assessment on a later visit.
nurseAssessmentSchema.index(
  { clinicId: 1, queueEntryId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
// Patient timeline lookups.
nurseAssessmentSchema.index({ clinicId: 1, patientId: 1, startedAt: -1 });

export const NurseAssessmentModel = model<NurseAssessmentDoc>('NurseAssessment', nurseAssessmentSchema);

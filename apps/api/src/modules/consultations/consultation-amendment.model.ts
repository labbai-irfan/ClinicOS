import { Schema, model, type Types } from 'mongoose';
import { tenantBase } from '../../database/plugins';

/**
 * Append-only audit trail for consultation amendments. Rows are created (never
 * updated or deleted) by consultation.service.ts whenever a finalized consultation
 * is amended, so the full history of what changed, why, and by whom is preserved.
 */
export interface ConsultationAmendmentDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId?: Types.ObjectId;
  consultationId: Types.ObjectId;
  reason: string;
  changes: Record<string, unknown>;
  amendedByUserId: Types.ObjectId;
  amendedByName: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const consultationAmendmentSchema = new Schema<ConsultationAmendmentDoc>(
  {
    consultationId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, required: true, trim: true },
    changes: { type: Schema.Types.Mixed, required: true },
    amendedByUserId: { type: Schema.Types.ObjectId, required: true },
    amendedByName: { type: String, required: true },
  },
  { collection: 'consultationAmendments' },
);

tenantBase(consultationAmendmentSchema);
consultationAmendmentSchema.index({ clinicId: 1, consultationId: 1, createdAt: -1 });

export const ConsultationAmendmentModel = model<ConsultationAmendmentDoc>(
  'ConsultationAmendment',
  consultationAmendmentSchema,
);

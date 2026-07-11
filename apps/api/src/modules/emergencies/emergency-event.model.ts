import { Schema, model, type Types } from 'mongoose';
import type { EmergencyStatus } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * Append-only audit trail for an emergency case (spec §19): arrival, triage, priority
 * confirmation, doctor alert/accept, assessment/treatment/observation entries, referral,
 * transfer, departure, discharge, closure. There is intentionally NO update or delete API
 * for this collection anywhere in this module — events are written once and never touched
 * again.
 */
export interface EmergencyEventDoc extends TenantFields {
  _id: Types.ObjectId;
  emergencyCaseId: Types.ObjectId;
  action: string;
  fromStatus?: EmergencyStatus;
  toStatus?: EmergencyStatus;
  actorUserId?: Types.ObjectId;
  actorName?: string;
  notes?: string;
}

const emergencyEventSchema = new Schema<EmergencyEventDoc>({
  emergencyCaseId: { type: Schema.Types.ObjectId, ref: 'EmergencyCase', required: true, index: true },
  action: { type: String, required: true },
  fromStatus: String,
  toStatus: String,
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  notes: String,
});

tenantBase(emergencyEventSchema);
emergencyEventSchema.index({ clinicId: 1, emergencyCaseId: 1, createdAt: 1 });

export const EmergencyEventModel = model<EmergencyEventDoc>('EmergencyEvent', emergencyEventSchema);

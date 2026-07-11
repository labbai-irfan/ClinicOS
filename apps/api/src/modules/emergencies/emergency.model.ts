import { Schema, model, type Types } from 'mongoose';
import type { ArrivalMode, EmergencyPriority, EmergencyStatus, Gender } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

export interface EmergencyReferral {
  facilityName: string;
  reason: string;
  notes?: string;
  transportMode?: string;
}

/**
 * A single ER case. Identity may be partial or unknown (spec §18) — patientId is
 * optional and patientLabel always carries a human-readable display fallback.
 * Priority defaults to "unconfirmed" and is NEVER auto-computed (spec §2.4, §18):
 * it is only ever set by triage()/assign() acting on behalf of clinical staff.
 */
export interface EmergencyCaseDoc extends TenantFields {
  _id: Types.ObjectId;
  caseCode: string;
  patientId?: Types.ObjectId;
  patientLabel: string;
  approximateAge?: number;
  gender: Gender;
  arrivalAt: Date;
  arrivalMode: ArrivalMode;
  mainConcern: string;
  mobile?: string;
  address?: string;
  emergencyContact?: string;
  status: EmergencyStatus;
  priority: EmergencyPriority;
  priorityConfirmedByUserId?: Types.ObjectId;
  assignedNurseId?: Types.ObjectId;
  assignedDoctorId?: Types.ObjectId;
  latestVitalsSummary?: string;
  referral?: EmergencyReferral;
}

const referralSchema = new Schema<EmergencyReferral>(
  {
    facilityName: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true },
    notes: String,
    transportMode: String,
  },
  { _id: false },
);

const emergencyCaseSchema = new Schema<EmergencyCaseDoc>({
  caseCode: { type: String, required: true, trim: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
  patientLabel: { type: String, required: true, trim: true },
  approximateAge: Number,
  gender: { type: String, required: true },
  arrivalAt: { type: Date, required: true },
  arrivalMode: { type: String, required: true },
  mainConcern: { type: String, required: true, trim: true },
  mobile: String,
  address: String,
  emergencyContact: String,
  status: { type: String, required: true, index: true },
  // Clinical urgency is always assigned/confirmed by authorized staff — never computed.
  priority: { type: String, required: true, default: 'unconfirmed' },
  priorityConfirmedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedNurseId: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedDoctorId: { type: Schema.Types.ObjectId, ref: 'User' },
  latestVitalsSummary: String,
  referral: { type: referralSchema, default: undefined },
});

tenantBase(emergencyCaseSchema);
emergencyCaseSchema.index({ clinicId: 1, caseCode: 1 }, { unique: true });
emergencyCaseSchema.index({ clinicId: 1, branchId: 1, status: 1, arrivalAt: 1 });

export const EmergencyCaseModel = model<EmergencyCaseDoc>('EmergencyCase', emergencyCaseSchema);

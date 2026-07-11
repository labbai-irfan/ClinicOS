import { Schema, model, type Types } from 'mongoose';
import { REJOIN_POLICIES, type RejoinPolicy } from '@clinicos/types';
import { DEFAULTS } from '@clinicos/config';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * Clinic-wide scheduling/queue/prescription defaults configured in onboarding step 6
 * and editable later from the admin settings screen (spec §8, §14). One document per
 * clinic — not branch-scoped — so this uses `tenantBase(schema, { branch: false })`.
 */
export interface ClinicSettingsDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  appointmentWindowMinutes: number;
  appointmentBufferMinutes: number;
  rejoinPolicy: RejoinPolicy;
  walkInCapacityPerDay: number;
  prescriptionShowDiagnosisDefault: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const clinicSettingsSchema = new Schema<ClinicSettingsDoc>(
  {
    appointmentWindowMinutes: {
      type: Number,
      required: true,
      default: DEFAULTS.APPOINTMENT_WINDOW_MINUTES,
    },
    appointmentBufferMinutes: {
      type: Number,
      required: true,
      default: DEFAULTS.APPOINTMENT_BUFFER_MINUTES,
    },
    rejoinPolicy: {
      type: String,
      required: true,
      enum: REJOIN_POLICIES,
      default: DEFAULTS.REJOIN_POLICY,
    },
    walkInCapacityPerDay: { type: Number, required: true, default: 50 },
    prescriptionShowDiagnosisDefault: { type: Boolean, required: true, default: false },
  },
  { collection: 'clinicSettings' },
);

tenantBase(clinicSettingsSchema, { branch: false });

clinicSettingsSchema.index({ clinicId: 1 }, { unique: true });

/** Primary export for this file (canonical model registry). */
export const ClinicSettingsModel = model<ClinicSettingsDoc>('ClinicSettings', clinicSettingsSchema);

/** Token numbering scope: one running sequence per branch, per doctor, or per department (spec §14). */
export const TOKEN_MODES = ['branch', 'doctor', 'department'] as const;
export type TokenMode = (typeof TOKEN_MODES)[number];

/**
 * Per-branch token generation configuration (spec §14) — how the queue module should
 * label/pad/reset patient tokens for a given branch. This module is the source of
 * truth for the admin UI; the queues module intentionally does NOT import this model
 * (it uses its own best-effort defaults) to avoid a circular dependency. Wiring the
 * queue token-generation path to read from here is a later refinement.
 */
export interface TokenSettingsDoc extends TenantFields {
  _id: Types.ObjectId;
  mode: TokenMode;
  prefix: string;
  pad: number;
  dailyReset: boolean;
}

const tokenSettingsSchema = new Schema<TokenSettingsDoc>(
  {
    mode: { type: String, required: true, enum: TOKEN_MODES, default: 'branch' },
    prefix: { type: String, required: true, trim: true, default: DEFAULTS.TOKEN_PREFIX },
    pad: { type: Number, required: true, default: DEFAULTS.TOKEN_PAD },
    dailyReset: { type: Boolean, required: true, default: true },
  },
  { collection: 'tokenSettings' },
);

tenantBase(tokenSettingsSchema);

tokenSettingsSchema.index({ branchId: 1 }, { unique: true });

export const TokenSettingsModel = model<TokenSettingsDoc>('TokenSettings', tokenSettingsSchema);

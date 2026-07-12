import { Schema, model, type Types } from 'mongoose';
import type { RoleKey } from '@clinicos/types';
import { tenantBase } from '../../database/plugins';

/**
 * Per-clinic staff profile (spec §9): professional details + doctor fees for a user's
 * membership in a clinic. `roleKey`/`isActive` mirror the membership (which remains the
 * source of truth for login access); the profile carries the doctor-facing fields the
 * prescription/billing modules read (qualification, registrationNumber, fees).
 * Clinic-scoped, not branch-scoped.
 */
export interface StaffProfileDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  userId: Types.ObjectId;
  roleKey: RoleKey;
  specialization?: string;
  qualification?: string;
  registrationNumber?: string;
  consultationFeePaise?: number;
  followUpFeePaise?: number;
  avgConsultationMinutes: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const staffProfileSchema = new Schema<StaffProfileDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  roleKey: { type: String, required: true },
  specialization: { type: String, trim: true },
  qualification: { type: String, trim: true },
  registrationNumber: { type: String, trim: true },
  consultationFeePaise: Number,
  followUpFeePaise: Number,
  avgConsultationMinutes: { type: Number, default: 12 },
  isActive: { type: Boolean, default: true },
});

tenantBase(staffProfileSchema, { branch: false });

// One profile per user per clinic — invite/list get-or-create against this key.
staffProfileSchema.index({ clinicId: 1, userId: 1 }, { unique: true });

export const StaffProfileModel = model<StaffProfileDoc>('staffProfiles', staffProfileSchema);

import { Schema, model } from 'mongoose';
import { tenantBase } from '../../database/plugins';

export const staffProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'users', required: true },
  roleKey: { type: String, required: true },
  specialization: String,
  qualification: String,
  registrationNumber: String,
  consultationFeePaise: Number,
  followUpFeePaise: Number,
  avgConsultationMinutes: { type: Number, default: 12 },
  isActive: { type: Boolean, default: true },
});

tenantBase(staffProfileSchema, { branch: false });

export const StaffProfileModel = model('staffProfiles', staffProfileSchema);

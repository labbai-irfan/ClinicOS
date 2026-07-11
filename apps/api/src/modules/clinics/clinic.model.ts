import { Schema, model, type Types } from 'mongoose';

export interface ClinicDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  timezone: string;
  onboardingStep: number;
  onboardingComplete: boolean;
  prescriptionHeader?: string;
  prescriptionFooter?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clinicSchema = new Schema<ClinicDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    phone: String,
    email: String,
    logoUrl: String,
    timezone: { type: String, default: 'Asia/Kolkata' },
    onboardingStep: { type: Number, default: 1 },
    onboardingComplete: { type: Boolean, default: false },
    prescriptionHeader: String,
    prescriptionFooter: String,
    isActive: { type: Boolean, default: true },
  },
  { collection: 'clinics', timestamps: true },
);

export const ClinicModel = model<ClinicDoc>('Clinic', clinicSchema);

import { Schema, model, type Types } from 'mongoose';
import type { Weekday } from '@clinicos/types';

export interface WorkingHour {
  day: Weekday;
  open: string;
  close: string;
  closed: boolean;
}

export interface BranchDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  workingHours: WorkingHour[];
  announcement?: string;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<BranchDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    phone: String,
    workingHours: [
      {
        _id: false,
        day: { type: String, required: true },
        open: { type: String, default: '09:00' },
        close: { type: String, default: '18:00' },
        closed: { type: Boolean, default: false },
      },
    ],
    announcement: String,
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'branches', timestamps: true },
);

branchSchema.index({ clinicId: 1, isActive: 1 });

export const BranchModel = model<BranchDoc>('Branch', branchSchema);

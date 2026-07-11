import { Schema, model, type Types } from 'mongoose';
import type { RoleKey } from '@clinicos/types';

export interface MembershipDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  roleId: Types.ObjectId;
  roleKey: RoleKey;
  branchIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, required: true },
    roleKey: { type: String, required: true },
    branchIds: { type: [Schema.Types.ObjectId], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'memberships', timestamps: true },
);

membershipSchema.index({ userId: 1, clinicId: 1 }, { unique: true });

export const MembershipModel = model<MembershipDoc>('Membership', membershipSchema);

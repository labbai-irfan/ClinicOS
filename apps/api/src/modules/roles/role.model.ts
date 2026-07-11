import { Schema, model, type Types } from 'mongoose';
import type { Permission, RoleKey } from '@clinicos/types';

export interface RoleDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  key: RoleKey;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { collection: 'roles', timestamps: true },
);

roleSchema.index({ clinicId: 1, key: 1 }, { unique: true });

export const RoleModel = model<RoleDoc>('Role', roleSchema);

import { Schema, model, type Types } from 'mongoose';
import type { Permission, RoleKey } from '@clinicos/types';

/**
 * System roles carry a key from ROLE_KEYS; clinic-defined custom roles use their own
 * slug key (e.g. `billing_clerk`). The intersection trick keeps RoleKey autocomplete
 * while still admitting custom keys.
 */
export type RoleKeyValue = RoleKey | (string & {});

export interface RoleDoc {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  key: RoleKeyValue;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { collection: 'roles', timestamps: true },
);

roleSchema.index({ clinicId: 1, key: 1 }, { unique: true });

export const RoleModel = model<RoleDoc>('Role', roleSchema);

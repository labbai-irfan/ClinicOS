import type { Schema } from 'mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export interface TenantFields {
  organizationId: MongooseSchema.Types.ObjectId;
  clinicId: MongooseSchema.Types.ObjectId;
  branchId?: MongooseSchema.Types.ObjectId;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TenantBaseOptions {
  /** Set false for clinic-level documents that are not branch-scoped. */
  branch?: boolean;
}

/**
 * Adds tenant ownership fields, timestamps and soft-delete to a schema.
 * Every tenant-owned collection MUST use this plugin, and every query MUST filter
 * by clinicId (and branchId where applicable) from `req.tenant` — never from input.
 */
export function tenantBase(schema: Schema, options: TenantBaseOptions = {}): void {
  schema.add({
    organizationId: { type: MongooseSchema.Types.ObjectId, required: true, index: true },
    clinicId: { type: MongooseSchema.Types.ObjectId, required: true, index: true },
    ...(options.branch === false
      ? {}
      : { branchId: { type: MongooseSchema.Types.ObjectId, index: true } }),
    deletedAt: { type: Date, default: null },
  });
  schema.set('timestamps', true);
}

/** Standard filter fragment excluding soft-deleted documents. */
export const notDeleted = { deletedAt: null } as const;

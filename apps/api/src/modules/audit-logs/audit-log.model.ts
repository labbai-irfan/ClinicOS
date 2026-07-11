import { Schema, model, type Types } from 'mongoose';

export interface AuditLogDoc {
  _id: Types.ObjectId;
  organizationId?: Types.ObjectId;
  clinicId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  userId?: Types.ObjectId;
  userName?: string;
  roleKey?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  createdAt: Date;
}

/**
 * Append-only. There is deliberately no update/delete service or route for this
 * collection — audit records must not be editable through application APIs.
 */
const auditLogSchema = new Schema<AuditLogDoc>(
  {
    organizationId: { type: Schema.Types.ObjectId, index: true },
    clinicId: { type: Schema.Types.ObjectId, index: true },
    branchId: { type: Schema.Types.ObjectId },
    userId: { type: Schema.Types.ObjectId },
    userName: String,
    roleKey: String,
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
    ip: String,
    userAgent: String,
    requestId: String,
  },
  { collection: 'auditLogs', timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ clinicId: 1, createdAt: -1 });
auditLogSchema.index({ clinicId: 1, resource: 1, resourceId: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLogDoc>('AuditLog', auditLogSchema);

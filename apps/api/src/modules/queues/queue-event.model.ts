import { Schema, model, type Types } from 'mongoose';
import type { QueueAuditedAction, QueueStatus } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * Immutable per-entry history (spec §16). Every status change (and every non-status
 * action such as a doctor transfer) appends one row here. There is deliberately no
 * update or delete API for this collection — it is the append-only audit trail behind
 * the queue's live board.
 */
export type QueueEventAction = 'created' | 'transition' | QueueAuditedAction;

export interface QueueEventDoc extends TenantFields {
  _id: Types.ObjectId;
  queueEntryId: Types.ObjectId;
  fromStatus?: QueueStatus;
  toStatus: QueueStatus;
  action?: QueueEventAction;
  reason?: string;
  actorUserId?: Types.ObjectId;
  actorName?: string;
}

const queueEventSchema = new Schema<QueueEventDoc>(
  {
    queueEntryId: { type: Schema.Types.ObjectId, required: true, index: true },
    fromStatus: String,
    toStatus: { type: String, required: true },
    action: String,
    reason: String,
    actorUserId: { type: Schema.Types.ObjectId },
    actorName: String,
  },
  { collection: 'queue_events' },
);

queueEventSchema.plugin(tenantBase);

queueEventSchema.index({ clinicId: 1, queueEntryId: 1, createdAt: 1 });

export const QueueEventModel = model<QueueEventDoc>('QueueEvent', queueEventSchema);

import { Schema, model, type Types } from 'mongoose';
import type { PatientPresence, QueueEntrySource, QueueStatus } from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * A single patient's place in the live queue for one branch on one local calendar day
 * (spec §14-17). `date` is the clinic-local YYYY-MM-DD the entry belongs to (not UTC),
 * matching the scope key used to mint `token`. `position` orders entries within the
 * day (lower = earlier in line); it is assigned on creation and only ever mutated by
 * explicit reposition actions (rejoin). `version` backs optimistic concurrency on
 * `PATCH /queues/:id/transition` (spec §35).
 */
export interface QueueEntryDoc extends TenantFields {
  _id: Types.ObjectId;
  date: string;
  token: string;
  patientId: Types.ObjectId;
  appointmentId?: Types.ObjectId;
  source: QueueEntrySource;
  doctorId?: Types.ObjectId;
  status: QueueStatus;
  presence: PatientPresence;
  priority: number;
  position: number;
  reasonForVisit?: string;
  checkedInAt?: Date;
  consultationStartedAt?: Date;
  consultationCompletedAt?: Date;
  version: number;
}

const queueEntrySchema = new Schema<QueueEntryDoc>(
  {
    date: { type: String, required: true },
    token: { type: String, required: true },
    patientId: { type: Schema.Types.ObjectId, required: true, index: true },
    appointmentId: { type: Schema.Types.ObjectId },
    source: { type: String, required: true },
    doctorId: { type: Schema.Types.ObjectId },
    status: { type: String, required: true },
    presence: { type: String, required: true, default: 'present' },
    priority: { type: Number, required: true, default: 0 },
    position: { type: Number, required: true, default: 0 },
    reasonForVisit: String,
    checkedInAt: Date,
    consultationStartedAt: Date,
    consultationCompletedAt: Date,
    version: { type: Number, required: true, default: 0 },
  },
  { collection: 'queue_entries' },
);

queueEntrySchema.plugin(tenantBase);

// Board/list queries: every entry for a branch on a given day, filtered by status.
queueEntrySchema.index({ clinicId: 1, branchId: 1, date: 1, status: 1 });
// Doctor-scoped ordering + wait-estimate lookups (position ordering, in-progress lookup).
queueEntrySchema.index({ clinicId: 1, branchId: 1, date: 1, doctorId: 1, position: 1 });

export const QueueEntryModel = model<QueueEntryDoc>('QueueEntry', queueEntrySchema);

import { Schema, model } from 'mongoose';

interface SequenceCounterDoc {
  key: string;
  value: number;
}

const sequenceSchema = new Schema<SequenceCounterDoc>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { collection: 'sequenceCounters', versionKey: false },
);

export const SequenceCounterModel = model<SequenceCounterDoc>('SequenceCounter', sequenceSchema);

/**
 * Atomically increment and return the next number for a scope key.
 * Scope keys embed tenant + purpose + reset window, e.g.
 * `token:<branchId>:<doctorId|all>:<YYYY-MM-DD>` or `invoice:<clinicId>:<YYYY>`.
 * Never compute max()+1 — this is the single source of sequence truth.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await SequenceCounterModel.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc.value;
}

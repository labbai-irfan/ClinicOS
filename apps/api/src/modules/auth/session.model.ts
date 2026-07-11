import { Schema, model, type Types } from 'mongoose';

export interface SessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** Family id groups rotated tokens; reuse of an old token revokes the family. */
  familyId: string;
  refreshTokenHash: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  revokedReason?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    ip: String,
    userAgent: String,
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: String,
    lastUsedAt: Date,
  },
  { collection: 'sessions', timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<SessionDoc>('Session', sessionSchema);

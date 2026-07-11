import { Schema, model } from 'mongoose';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

interface IdempotencyRecordDoc {
  key: string;
  userId?: string;
  method: string;
  path: string;
  status: number;
  body: unknown;
  createdAt: Date;
}

const idempotencySchema = new Schema<IdempotencyRecordDoc>(
  {
    key: { type: String, required: true },
    userId: String,
    method: String,
    path: String,
    status: Number,
    body: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
  { collection: 'idempotencyRecords', versionKey: false },
);
idempotencySchema.index({ key: 1, userId: 1 }, { unique: true });

const IdempotencyRecordModel = model<IdempotencyRecordDoc>(
  'IdempotencyRecord',
  idempotencySchema,
);

/**
 * Replay protection for critical mutations (payments, queue transitions,
 * finalizations). When the client sends an `Idempotency-Key` header, the first
 * successful response is stored and replayed verbatim for retries of the same key.
 */
export function idempotent(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0 || key.length > 128) {
      next();
      return;
    }
    const userId = req.auth?.userId?.toString();

    void IdempotencyRecordModel.findOne({ key, userId })
      .lean()
      .then((existing) => {
        if (existing) {
          res.setHeader('x-idempotent-replay', 'true');
          res.status(existing.status).json(existing.body);
          return;
        }
        const originalJson = res.json.bind(res);
        res.json = ((body: unknown) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            IdempotencyRecordModel.create({
              key,
              userId,
              method: req.method,
              path: req.path,
              status: res.statusCode,
              body,
            }).catch(() => undefined);
          }
          return originalJson(body);
        }) as Response['json'];
        next();
      })
      .catch(next);
  };
}

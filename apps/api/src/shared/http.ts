import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiMeta } from '@clinicos/types';

export function ok<T>(res: Response, data: T, meta: ApiMeta = {}): void {
  res.status(200).json({ success: true, data, meta: { requestId: res.req.requestId, ...meta } });
}

export function created<T>(res: Response, data: T, meta: ApiMeta = {}): void {
  res.status(201).json({ success: true, data, meta: { requestId: res.req.requestId, ...meta } });
}

export function noContent(res: Response): void {
  res.status(204).end();
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap async controllers so rejections reach the central error handler. */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

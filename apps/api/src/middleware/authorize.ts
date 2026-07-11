import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Permission } from '@clinicos/types';
import { ForbiddenError, UnauthenticatedError } from '../shared/errors';

/** Require one permission (or any of several) from the resolved tenant role. */
export function authorize(...required: Permission[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new UnauthenticatedError());
      return;
    }
    if (!req.tenant) {
      next(new ForbiddenError('No clinic context.'));
      return;
    }
    const has = required.some((p) => req.tenant!.permissions.has(p));
    if (!has) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

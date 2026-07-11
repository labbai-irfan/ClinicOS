import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../shared/errors';

type Target = 'body' | 'query' | 'params';

/** Validate and replace a request segment with its parsed (typed, defaulted) value. */
export function validate(schema: ZodTypeAny, target: Target = 'body'): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        message: issue.message,
      }));
      next(new ValidationError(details));
      return;
    }
    if (target === 'query') {
      // Express 4 query is a getter-backed object; store parsed copy alongside.
      Object.assign(req.query, result.data);
    } else {
      req[target] = result.data;
    }
    next();
  };
}

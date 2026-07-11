import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '@clinicos/types';
import { AppError } from '../shared/errors';
import { logger } from '../shared/logger';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: ERROR_CODES.NOT_FOUND, message: 'Route not found.', details: [] },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Mongo duplicate key
  if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
    res.status(409).json({
      success: false,
      error: { code: ERROR_CODES.DUPLICATE, message: 'A matching record already exists.', details: [] },
    });
    return;
  }

  logger.error({ err, requestId: req.requestId, url: req.originalUrl }, 'unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL,
      message: isProd ? 'Something went wrong. Please try again.' : String((err as Error)?.message ?? err),
      details: [],
    },
  });
}

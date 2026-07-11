import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { PERMISSIONS } from '@clinicos/types';
import { DEFAULTS } from '@clinicos/config';
import { documentListQuery, documentUploadSchema } from '@clinicos/validation';
import { authenticate, tenantContext, authorize, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import { AppError, ValidationError } from '../../shared/errors';
import * as controller from './document.controller';

const ALLOWED_MIME_TYPES: readonly string[] = DEFAULTS.ALLOWED_UPLOAD_MIME;

/**
 * memoryStorage — files are buffered in memory only long enough to stream them to
 * Cloudinary; nothing is ever written to local disk. fileFilter rejects mimetypes
 * outside the allow-list; the size limit rejects oversized files.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DEFAULTS.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new ValidationError([{ field: 'file', message: `Unsupported file type: ${file.mimetype}.` }]));
      return;
    }
    cb(null, true);
  },
});

/** Wraps multer's callback-style error handling so failures reach the central error handler. */
function uploadSingle(field: string) {
  const middleware = upload.single(field);
  return (req: Request, res: Response, next: NextFunction): void => {
    middleware(req, res, (err: unknown) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof AppError) {
        next(err);
        return;
      }
      if (err instanceof multer.MulterError) {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? `File exceeds the ${DEFAULTS.MAX_UPLOAD_MB}MB limit.`
            : err.message;
        next(new ValidationError([{ field: 'file', message }]));
        return;
      }
      next(err);
    });
  };
}

export const documentRoutes = Router();

documentRoutes.post(
  '/',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.DOCUMENT_UPLOAD),
  uploadSingle('file'),
  validate(documentUploadSchema, 'body'),
  asyncHandler(controller.upload),
);

documentRoutes.get(
  '/',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.DOCUMENT_READ),
  validate(documentListQuery, 'query'),
  asyncHandler(controller.list),
);

documentRoutes.get(
  '/:id/download',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.DOCUMENT_READ),
  asyncHandler(controller.download),
);

documentRoutes.post(
  '/:id/replace',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.DOCUMENT_MANAGE),
  uploadSingle('file'),
  validate(documentUploadSchema, 'body'),
  asyncHandler(controller.replace),
);

documentRoutes.patch(
  '/:id/archive',
  authenticate,
  tenantContext,
  authorize(PERMISSIONS.DOCUMENT_MANAGE),
  asyncHandler(controller.archive),
);

import { ERROR_CODES, type ApiErrorDetail, type ErrorCode } from '@clinicos/types';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ApiErrorDetail[];
  readonly expose: boolean;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: ApiErrorDetail[] = [],
    expose = true,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  constructor(details: ApiErrorDetail[], message = 'Please correct the highlighted fields.') {
    super(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Please sign in to continue.', code: ErrorCode = ERROR_CODES.UNAUTHENTICATED) {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, ERROR_CODES.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, ERROR_CODES.NOT_FOUND, `${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode = ERROR_CODES.CONFLICT) {
    super(409, code, message);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(409, ERROR_CODES.INVALID_TRANSITION, `Cannot move from "${from}" to "${to}".`);
  }
}

export class RecordFinalizedError extends AppError {
  constructor(resource = 'Record') {
    super(409, ERROR_CODES.RECORD_FINALIZED, `${resource} is finalized and cannot be edited directly. Create an amendment instead.`);
  }
}

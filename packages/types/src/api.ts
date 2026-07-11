export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  requestId?: string;
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details: ApiErrorDetail[];
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE: 'DUPLICATE',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  LOCKED: 'LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  IDEMPOTENCY_REPLAY: 'IDEMPOTENCY_REPLAY',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  DOUBLE_BOOKING: 'DOUBLE_BOOKING',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  RECORD_FINALIZED: 'RECORD_FINALIZED',
  PAYMENT_EXCEEDS_DUE: 'PAYMENT_EXCEEDS_DUE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

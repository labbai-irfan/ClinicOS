import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '@clinicos/types';
import { env, isTest } from '../config/env';

const failure = {
  success: false,
  error: {
    code: ERROR_CODES.RATE_LIMITED,
    message: 'Too many requests. Please wait a moment and try again.',
    details: [],
  },
};

export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 100_000 : env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: failure,
});

export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: isTest ? 100_000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: failure,
  skipSuccessfulRequests: true,
});

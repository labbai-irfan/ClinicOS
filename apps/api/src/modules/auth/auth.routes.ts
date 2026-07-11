import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerOwnerSchema,
  resetPasswordSchema,
} from '@clinicos/validation';
import { authenticate, authRateLimit, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './auth.controller';

export const authRoutes = Router();

authRoutes.post(
  '/register-owner',
  authRateLimit,
  validate(registerOwnerSchema),
  asyncHandler(controller.registerOwner),
);
authRoutes.post('/login', authRateLimit, validate(loginSchema), asyncHandler(controller.login));
authRoutes.post('/refresh', asyncHandler(controller.refresh));
authRoutes.post('/logout', authenticate, asyncHandler(controller.logout));
authRoutes.post('/logout-all', authenticate, asyncHandler(controller.logoutAll));
authRoutes.get('/me', authenticate, asyncHandler(controller.me));
authRoutes.post(
  '/forgot-password',
  authRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(controller.forgotPassword),
);
authRoutes.post(
  '/reset-password',
  authRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(controller.resetPassword),
);
authRoutes.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(controller.changePassword),
);
authRoutes.get('/sessions', authenticate, asyncHandler(controller.sessions));

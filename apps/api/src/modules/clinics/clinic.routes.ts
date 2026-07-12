import { Router } from 'express';
import { onboardingStepSchema, updateClinicSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './clinic.controller';

export const clinicRoutes = Router();

clinicRoutes.use(authenticate, tenantContext);

clinicRoutes.get('/me', asyncHandler(controller.getMe));

// Editable from both the onboarding wizard (ONBOARDING_MANAGE) and the admin
// settings screen (SETTINGS_MANAGE) — either permission grants the update.
clinicRoutes.patch(
  '/me',
  authorize(PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.ONBOARDING_MANAGE),
  validate(updateClinicSchema),
  asyncHandler(controller.updateMe),
);

clinicRoutes.patch(
  '/me/onboarding-step',
  authorize(PERMISSIONS.ONBOARDING_MANAGE),
  validate(onboardingStepSchema),
  asyncHandler(controller.advanceOnboardingStep),
);

clinicRoutes.post(
  '/me/activate',
  authorize(PERMISSIONS.ONBOARDING_MANAGE),
  asyncHandler(controller.activate),
);

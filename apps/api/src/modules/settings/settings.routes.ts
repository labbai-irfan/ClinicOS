import { Router } from 'express';
import { tokenSettingsQuery, tokenSettingsSchema, updateClinicSettingsSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './settings.controller';

export const settingsRoutes = Router();

settingsRoutes.use(authenticate, tenantContext);

settingsRoutes.get('/clinic', asyncHandler(controller.getClinicSettings));

settingsRoutes.patch(
  '/clinic',
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateClinicSettingsSchema),
  asyncHandler(controller.updateClinicSettings),
);

settingsRoutes.get(
  '/tokens',
  validate(tokenSettingsQuery, 'query'),
  asyncHandler(controller.getTokenSettings),
);

settingsRoutes.patch(
  '/tokens',
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(tokenSettingsSchema),
  asyncHandler(controller.updateTokenSettings),
);

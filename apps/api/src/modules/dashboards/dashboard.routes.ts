import { Router } from 'express';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './dashboard.controller';

export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate, tenantContext);

dashboardRoutes.get(
  '/summary',
  authorize(PERMISSIONS.DASHBOARD_VIEW),
  asyncHandler(controller.summary),
);

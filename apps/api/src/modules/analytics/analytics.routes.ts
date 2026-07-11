import { Router } from 'express';
import { z } from 'zod';
import { localDate } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './analytics.controller';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticate, tenantContext);

/** Every analytics endpoint takes a clinic-local [from, to] calendar-date range. */
const rangeQuery = z.object({ from: localDate, to: localDate });

analyticsRoutes.get(
  '/patients',
  authorize(PERMISSIONS.REPORTS_VIEW),
  validate(rangeQuery, 'query'),
  asyncHandler(controller.patients),
);

analyticsRoutes.get(
  '/queue',
  authorize(PERMISSIONS.REPORTS_VIEW),
  validate(rangeQuery, 'query'),
  asyncHandler(controller.queue),
);

analyticsRoutes.get(
  '/revenue',
  authorize(PERMISSIONS.REPORTS_VIEW),
  validate(rangeQuery, 'query'),
  asyncHandler(controller.revenue),
);

analyticsRoutes.get(
  '/emergency',
  authorize(PERMISSIONS.REPORTS_VIEW),
  validate(rangeQuery, 'query'),
  asyncHandler(controller.emergency),
);

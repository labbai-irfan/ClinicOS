import { Router } from 'express';
import { z } from 'zod';
import { vitalsSchema, objectId } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, tenantContext, authorize, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './vital.controller';

/** No shared cross-module query DTO exists for this filter set — kept local to the route. */
const vitalsListQuery = z.object({
  patientId: objectId.optional(),
  queueEntryId: objectId.optional(),
  emergencyCaseId: objectId.optional(),
});

export const vitalsRoutes = Router();

vitalsRoutes.use(authenticate, tenantContext);

vitalsRoutes.post(
  '/',
  authorize(PERMISSIONS.VITALS_CREATE),
  validate(vitalsSchema),
  asyncHandler(controller.createVital),
);

vitalsRoutes.get(
  '/',
  authorize(PERMISSIONS.VITALS_READ),
  validate(vitalsListQuery, 'query'),
  asyncHandler(controller.listVitals),
);

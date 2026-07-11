import { Router } from 'express';
import { z } from 'zod';
import {
  createEmergencySchema,
  emergencyAssignSchema,
  emergencyObservationSchema,
  emergencyReferralSchema,
  emergencyTransitionSchema,
  emergencyTriageSchema,
  objectId,
} from '@clinicos/validation';
import { EMERGENCY_STATUSES, PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './emergency.controller';

const idParams = z.object({ id: objectId });
const boardQuery = z.object({ status: z.enum(EMERGENCY_STATUSES).optional() });

export const emergencyRoutes = Router();

emergencyRoutes.use(authenticate, tenantContext);

emergencyRoutes.post(
  '/',
  authorize(PERMISSIONS.EMERGENCY_CREATE),
  validate(createEmergencySchema),
  asyncHandler(controller.create),
);

emergencyRoutes.get(
  '/',
  authorize(PERMISSIONS.EMERGENCY_READ),
  validate(boardQuery, 'query'),
  asyncHandler(controller.board),
);

emergencyRoutes.get(
  '/:id',
  authorize(PERMISSIONS.EMERGENCY_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.getOne),
);

emergencyRoutes.get(
  '/:id/events',
  authorize(PERMISSIONS.EMERGENCY_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.events),
);

emergencyRoutes.post(
  '/:id/triage',
  authorize(PERMISSIONS.EMERGENCY_TRIAGE),
  validate(idParams, 'params'),
  validate(emergencyTriageSchema),
  asyncHandler(controller.triage),
);

emergencyRoutes.patch(
  '/:id/status',
  authorize(PERMISSIONS.EMERGENCY_MANAGE),
  validate(idParams, 'params'),
  validate(emergencyTransitionSchema),
  asyncHandler(controller.transition),
);

emergencyRoutes.post(
  '/:id/assign',
  authorize(PERMISSIONS.EMERGENCY_ASSIGN),
  validate(idParams, 'params'),
  validate(emergencyAssignSchema),
  asyncHandler(controller.assign),
);

emergencyRoutes.post(
  '/:id/referral',
  authorize(PERMISSIONS.EMERGENCY_MANAGE),
  validate(idParams, 'params'),
  validate(emergencyReferralSchema),
  asyncHandler(controller.referral),
);

emergencyRoutes.post(
  '/:id/observation',
  authorize(PERMISSIONS.EMERGENCY_MANAGE),
  validate(idParams, 'params'),
  validate(emergencyObservationSchema),
  asyncHandler(controller.observation),
);

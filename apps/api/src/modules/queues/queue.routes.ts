import { Router } from 'express';
import { PERMISSIONS } from '@clinicos/types';
import {
  addToQueueSchema,
  callPatientSchema,
  queueListQuery,
  queueRejoinSchema,
  queueSkipSchema,
  queueTransferSchema,
  queueTransitionSchema,
} from '@clinicos/validation';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './queue.controller';

export const queueRoutes = Router();

queueRoutes.use(authenticate, tenantContext);

queueRoutes.get(
  '/',
  authorize(PERMISSIONS.QUEUE_READ),
  validate(queueListQuery, 'query'),
  asyncHandler(controller.list),
);

queueRoutes.post(
  '/',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  validate(addToQueueSchema),
  asyncHandler(controller.addToQueue),
);

queueRoutes.patch(
  '/:id/transition',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  validate(queueTransitionSchema),
  asyncHandler(controller.transition),
);

queueRoutes.post(
  '/:id/skip',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  validate(queueSkipSchema),
  asyncHandler(controller.skip),
);

// Base action needs QUEUE_MANAGE; `policy: 'manual'` additionally requires QUEUE_OVERRIDE
// (checked in the service, since that depends on the request body, not just the route).
queueRoutes.post(
  '/:id/rejoin',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  validate(queueRejoinSchema),
  asyncHandler(controller.rejoin),
);

queueRoutes.post(
  '/:id/transfer',
  authorize(PERMISSIONS.QUEUE_OVERRIDE),
  validate(queueTransferSchema),
  asyncHandler(controller.transferDoctor),
);

queueRoutes.post(
  '/:id/call',
  authorize(PERMISSIONS.QUEUE_MANAGE),
  validate(callPatientSchema),
  asyncHandler(controller.callPatient),
);

import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '@clinicos/types';
import {
  availableSlotsQuery,
  doctorLeaveListQuery,
  doctorLeaveSchema,
  doctorScheduleQuery,
  doctorScheduleSchema,
  objectId,
} from '@clinicos/validation';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './schedule.controller';

const leaveIdParams = z.object({ id: objectId });

export const scheduleRoutes = Router();

scheduleRoutes.use(authenticate, tenantContext);

// Reads are open to any authenticated clinic member (booking flows need the slot
// grid); every mutation is gated by SCHEDULE_MANAGE.
scheduleRoutes.get('/', validate(doctorScheduleQuery, 'query'), asyncHandler(controller.getOrList));

scheduleRoutes.post(
  '/',
  authorize(PERMISSIONS.SCHEDULE_MANAGE),
  validate(doctorScheduleSchema),
  asyncHandler(controller.upsert),
);

// Upsert semantics are identical either way — kept as an alias for PUT callers.
scheduleRoutes.put(
  '/',
  authorize(PERMISSIONS.SCHEDULE_MANAGE),
  validate(doctorScheduleSchema),
  asyncHandler(controller.upsert),
);

scheduleRoutes.get(
  '/available-slots',
  validate(availableSlotsQuery, 'query'),
  asyncHandler(controller.availableSlots),
);

scheduleRoutes.get(
  '/leaves',
  validate(doctorLeaveListQuery, 'query'),
  asyncHandler(controller.listLeaves),
);

scheduleRoutes.post(
  '/leaves',
  authorize(PERMISSIONS.SCHEDULE_MANAGE),
  validate(doctorLeaveSchema),
  asyncHandler(controller.addLeave),
);

scheduleRoutes.delete(
  '/leaves/:id',
  authorize(PERMISSIONS.SCHEDULE_MANAGE),
  validate(leaveIdParams, 'params'),
  asyncHandler(controller.removeLeave),
);

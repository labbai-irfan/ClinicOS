import { Router } from 'express';
import { PERMISSIONS } from '@clinicos/types';
import {
  appointmentListQuery,
  appointmentStatusSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
} from '@clinicos/validation';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './appointment.controller';

export const appointmentRoutes = Router();

appointmentRoutes.use(authenticate, tenantContext);

appointmentRoutes.post(
  '/',
  authorize(PERMISSIONS.APPOINTMENT_CREATE),
  validate(createAppointmentSchema),
  asyncHandler(controller.create),
);

appointmentRoutes.get(
  '/',
  authorize(PERMISSIONS.APPOINTMENT_READ),
  validate(appointmentListQuery, 'query'),
  asyncHandler(controller.list),
);

appointmentRoutes.get('/:id', authorize(PERMISSIONS.APPOINTMENT_READ), asyncHandler(controller.get));

appointmentRoutes.patch(
  '/:id/reschedule',
  authorize(PERMISSIONS.APPOINTMENT_RESCHEDULE),
  validate(rescheduleAppointmentSchema),
  asyncHandler(controller.reschedule),
);

// Cancellation shares this route (status: 'cancelled') but is gated additionally
// inside the controller — see appointment.controller.ts.
appointmentRoutes.patch(
  '/:id/status',
  authorize(PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.APPOINTMENT_CREATE),
  validate(appointmentStatusSchema),
  asyncHandler(controller.changeStatus),
);

import { Router } from 'express';
import { authenticate, validate } from '../../middleware';
import { patientTenantContext } from '../../middleware/patient-tenant';
import { asyncHandler } from '../../shared/http';
import * as controller from './patient-appointments.controller';
import { z } from 'zod';

export const patientAppointmentRoutes = Router();

// Patient endpoints require authentication and patient tenant context
patientAppointmentRoutes.use(authenticate, patientTenantContext);

// GET /patient/me - List patient's appointments
patientAppointmentRoutes.get(
  '/me',
  validate(
    z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      status: z.string().optional(),
    }),
    'query',
  ),
  asyncHandler(controller.listPatientAppointments),
);

// POST /patient/book - Book a new appointment
patientAppointmentRoutes.post(
  '/book',
  validate(
    z.object({
      doctorId: z.string(),
      branchId: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      reason: z.string().optional(),
    }),
  ),
  asyncHandler(controller.bookPatientAppointment),
);

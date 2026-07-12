import { Router } from 'express';
import { staffListQuery, updatePatientSchema } from '@clinicos/validation';
import { availableSlotsQuery } from '@clinicos/validation';
import { authenticate, validate } from '../../middleware';
import { patientTenantContext } from '../../middleware/patient-tenant';
import { asyncHandler } from '../../shared/http';
import * as controller from './patient-patient.controller';
import * as branchController from '../branches/branch.controller';
import * as staffController from '../staff/staff.controller';
import * as scheduleController from '../schedules/schedule.controller';

export const patientPatientRoutes = Router();

// Patient endpoints require authentication and patient tenant context
patientPatientRoutes.use(authenticate, patientTenantContext);

// GET /patient/me - Get the authenticated patient's profile
patientPatientRoutes.get(
  '/me',
  asyncHandler(controller.getPatientProfile),
);

// PATCH /patient/me - Update the authenticated patient's own profile
patientPatientRoutes.patch(
  '/me',
  validate(updatePatientSchema),
  asyncHandler(controller.updatePatientProfile),
);

// GET /patient/branches - Branches of the patient's own clinic (booking flow: pick a branch)
patientPatientRoutes.get('/branches', asyncHandler(branchController.list));

// GET /patient/doctors - Doctors in the patient's clinic (booking flow: pick a doctor)
patientPatientRoutes.get(
  '/doctors',
  validate(staffListQuery, 'query'),
  asyncHandler(staffController.list),
);

// GET /patient/available-slots - Open slots for a doctor/date (booking flow: pick a time)
patientPatientRoutes.get(
  '/available-slots',
  validate(availableSlotsQuery, 'query'),
  asyncHandler(scheduleController.availableSlots),
);

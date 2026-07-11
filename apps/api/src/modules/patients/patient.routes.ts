import { Router } from 'express';
import { z } from 'zod';
import {
  localDate,
  mergePatientsSchema,
  mobileNumber,
  objectId,
  patientSearchQuery,
  quickRegisterPatientSchema,
  updatePatientSchema,
} from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './patient.controller';

const idParamSchema = z.object({ id: objectId });

/** Lightweight query for the non-blocking duplicate-warning endpoint (spec §12). */
const checkDuplicatesQuery = z.object({
  mobile: mobileNumber.optional(),
  fullName: z.string().trim().min(1).max(160).optional(),
  dateOfBirth: localDate.optional(),
});

export const patientRoutes = Router();

patientRoutes.use(authenticate, tenantContext);

patientRoutes.get(
  '/check-duplicates',
  authorize(PERMISSIONS.PATIENT_CREATE, PERMISSIONS.PATIENT_READ_BASIC),
  validate(checkDuplicatesQuery, 'query'),
  asyncHandler(controller.checkDuplicates),
);

patientRoutes.get(
  '/',
  authorize(PERMISSIONS.PATIENT_READ_BASIC),
  validate(patientSearchQuery, 'query'),
  asyncHandler(controller.search),
);

patientRoutes.post(
  '/',
  authorize(PERMISSIONS.PATIENT_CREATE),
  validate(quickRegisterPatientSchema),
  asyncHandler(controller.create),
);

patientRoutes.post(
  '/merge',
  authorize(PERMISSIONS.PATIENT_MERGE),
  validate(mergePatientsSchema),
  asyncHandler(controller.merge),
);

patientRoutes.get(
  '/:id',
  authorize(PERMISSIONS.PATIENT_READ_BASIC),
  validate(idParamSchema, 'params'),
  asyncHandler(controller.getProfile),
);

patientRoutes.patch(
  '/:id',
  authorize(PERMISSIONS.PATIENT_UPDATE),
  validate(idParamSchema, 'params'),
  validate(updatePatientSchema),
  asyncHandler(controller.update),
);

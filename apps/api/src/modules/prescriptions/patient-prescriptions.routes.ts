import { Router } from 'express';
import { z } from 'zod';
import { objectId } from '@clinicos/validation';
import { authenticate, validate } from '../../middleware';
import { patientTenantContext } from '../../middleware/patient-tenant';
import { asyncHandler } from '../../shared/http';
import * as controller from './patient-prescriptions.controller';

export const patientPrescriptionRoutes = Router();

// Patient endpoints require authentication and patient tenant context
patientPrescriptionRoutes.use(authenticate, patientTenantContext);

const idParams = z.object({ id: objectId });

// GET /patient/me - List patient's prescriptions
patientPrescriptionRoutes.get(
  '/me',
  asyncHandler(controller.listPatientPrescriptions),
);

// GET /patient/:id/download - Stream the prescription PDF
patientPrescriptionRoutes.get(
  '/:id/download',
  validate(idParams, 'params'),
  asyncHandler(controller.downloadPatientPrescriptionPdf),
);

// GET /patient/:id - Get single prescription detail
patientPrescriptionRoutes.get(
  '/:id',
  validate(idParams, 'params'),
  asyncHandler(controller.getPatientPrescription),
);

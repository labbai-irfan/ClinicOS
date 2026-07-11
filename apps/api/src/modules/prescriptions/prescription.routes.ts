import { Router } from 'express';
import { z } from 'zod';
import { prescriptionSchema, objectId } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, tenantContext, authorize, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './prescription.controller';

export const prescriptionRoutes = Router();

prescriptionRoutes.use(authenticate, tenantContext);

const idParams = z.object({ id: objectId });
const consultationParams = z.object({ consultationId: objectId });

// Autosave-friendly upsert: draft saves only need PRESCRIPTION_CREATE; finalizing also
// requires PRESCRIPTION_SIGN, enforced inside the controller since it depends on the
// request body (`finalize`), not just the route.
prescriptionRoutes.post(
  '/',
  authorize(PERMISSIONS.PRESCRIPTION_CREATE),
  validate(prescriptionSchema),
  asyncHandler(controller.save),
);

prescriptionRoutes.get(
  '/by-consultation/:consultationId',
  authorize(PERMISSIONS.PRESCRIPTION_READ),
  validate(consultationParams, 'params'),
  asyncHandler(controller.getByConsultation),
);

prescriptionRoutes.get(
  '/:id/pdf',
  authorize(PERMISSIONS.PRESCRIPTION_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.downloadPdf),
);

prescriptionRoutes.get(
  '/:id',
  authorize(PERMISSIONS.PRESCRIPTION_READ),
  validate(idParams, 'params'),
  asyncHandler(controller.getById),
);

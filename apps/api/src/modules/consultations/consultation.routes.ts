import { Router } from 'express';
import { amendConsultationSchema, consultationSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as consultationController from './consultation.controller';

export const consultationRoutes = Router();

consultationRoutes.use(authenticate, tenantContext);

consultationRoutes.post(
  '/',
  authorize(PERMISSIONS.CONSULTATION_CREATE),
  validate(consultationSchema),
  asyncHandler(consultationController.start),
);

consultationRoutes.patch(
  '/:id/amend',
  authorize(PERMISSIONS.CONSULTATION_AMEND),
  validate(amendConsultationSchema),
  asyncHandler(consultationController.amend),
);

consultationRoutes.get(
  '/by-patient/:patientId',
  authorize(PERMISSIONS.CONSULTATION_READ),
  asyncHandler(consultationController.listByPatient),
);

consultationRoutes.get(
  '/:id/amendments',
  authorize(PERMISSIONS.CONSULTATION_READ),
  asyncHandler(consultationController.listAmendments),
);

consultationRoutes.get(
  '/:id',
  authorize(PERMISSIONS.CONSULTATION_READ),
  asyncHandler(consultationController.getById),
);

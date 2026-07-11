import { Router } from 'express';
import { z } from 'zod';
import { nurseAssessmentSchema, objectId } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, tenantContext, authorize, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './nurse-assessment.controller';

export const nurseAssessmentRoutes = Router();

nurseAssessmentRoutes.use(authenticate, tenantContext);

// Autosave-friendly upsert: repeated calls with the same queueEntryId update the same
// draft in place until `complete: true` is sent on the final save.
nurseAssessmentRoutes.post(
  '/',
  authorize(PERMISSIONS.ASSESSMENT_CREATE),
  validate(nurseAssessmentSchema),
  asyncHandler(controller.save),
);

nurseAssessmentRoutes.get(
  '/by-queue-entry/:queueEntryId',
  authorize(PERMISSIONS.ASSESSMENT_READ),
  validate(z.object({ queueEntryId: objectId }), 'params'),
  asyncHandler(controller.getByQueueEntry),
);

nurseAssessmentRoutes.get(
  '/by-patient/:patientId',
  authorize(PERMISSIONS.ASSESSMENT_READ),
  validate(z.object({ patientId: objectId }), 'params'),
  asyncHandler(controller.getByPatient),
);

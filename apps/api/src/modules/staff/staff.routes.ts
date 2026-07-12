import { Router } from 'express';
import { z } from 'zod';
import { inviteStaffSchema, objectId, staffListQuery, updateStaffSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './staff.controller';

const idParamSchema = z.object({ id: objectId });

export const staffRoutes = Router();

staffRoutes.use(authenticate, tenantContext);

// Directory read is open to any authenticated clinic member — appointment booking
// (doctor select) and emergency assignment read it. Mutations require staff.manage.
staffRoutes.get('/', validate(staffListQuery, 'query'), asyncHandler(controller.list));

staffRoutes.post(
  '/',
  authorize(PERMISSIONS.STAFF_MANAGE),
  validate(inviteStaffSchema),
  asyncHandler(controller.invite),
);

staffRoutes.patch(
  '/:id',
  authorize(PERMISSIONS.STAFF_MANAGE),
  validate(idParamSchema, 'params'),
  validate(updateStaffSchema),
  asyncHandler(controller.update),
);

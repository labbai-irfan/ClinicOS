import { Router } from 'express';
import { z } from 'zod';
import { createBranchSchema, objectId, updateBranchSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './branch.controller';

const idParamSchema = z.object({ id: objectId });

export const branchRoutes = Router();

branchRoutes.use(authenticate, tenantContext);

// Any authenticated staff member may list their clinic's branches (branch pickers in
// scheduling, staff invites, token settings, queue displays all need this).
branchRoutes.get('/', asyncHandler(controller.list));

branchRoutes.post(
  '/',
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(createBranchSchema),
  asyncHandler(controller.create),
);

branchRoutes.patch(
  '/:id',
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(idParamSchema, 'params'),
  validate(updateBranchSchema),
  asyncHandler(controller.update),
);

branchRoutes.delete(
  '/:id',
  authorize(PERMISSIONS.SETTINGS_MANAGE),
  validate(idParamSchema, 'params'),
  asyncHandler(controller.deactivate),
);

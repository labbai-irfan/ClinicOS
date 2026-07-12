import { Router } from 'express';
import { z } from 'zod';
import { createRoleSchema, deleteRoleSchema, objectId, updateRoleSchema } from '@clinicos/validation';
import { PERMISSIONS } from '@clinicos/types';
import { authenticate, authorize, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './role.controller';

const idParamSchema = z.object({ id: objectId });

export const roleRoutes = Router();

roleRoutes.use(authenticate, tenantContext);

roleRoutes.get('/', asyncHandler(controller.list));

roleRoutes.get('/permissions-catalog', asyncHandler(controller.permissionsCatalog));

roleRoutes.post(
  '/',
  authorize(PERMISSIONS.ROLE_MANAGE),
  validate(createRoleSchema),
  asyncHandler(controller.create),
);

roleRoutes.patch(
  '/:id',
  authorize(PERMISSIONS.ROLE_MANAGE),
  validate(idParamSchema, 'params'),
  validate(updateRoleSchema),
  asyncHandler(controller.update),
);

roleRoutes.delete(
  '/:id',
  authorize(PERMISSIONS.ROLE_MANAGE),
  validate(idParamSchema, 'params'),
  validate(deleteRoleSchema),
  asyncHandler(controller.remove),
);

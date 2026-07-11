import { Router } from 'express';
import { notificationListQuery, notificationPreferencesUpdateSchema } from '@clinicos/validation';
import { authenticate, tenantContext, validate } from '../../middleware';
import { asyncHandler } from '../../shared/http';
import * as controller from './notification.controller';

/**
 * Notifications are per-user, not permission-gated beyond being an authenticated
 * clinic member — every route only ever touches the caller's own inbox
 * (req.auth.userId), so `authenticate` + `tenantContext` is sufficient (spec §27).
 */
export const notificationRoutes = Router();

notificationRoutes.use(authenticate, tenantContext);

notificationRoutes.get('/', validate(notificationListQuery, 'query'), asyncHandler(controller.list));

notificationRoutes.get('/preferences', asyncHandler(controller.getPreferences));

notificationRoutes.patch(
  '/preferences',
  validate(notificationPreferencesUpdateSchema),
  asyncHandler(controller.updatePreferences),
);

notificationRoutes.patch('/:id/read', asyncHandler(controller.markRead));

notificationRoutes.post('/mark-all-read', asyncHandler(controller.markAllRead));

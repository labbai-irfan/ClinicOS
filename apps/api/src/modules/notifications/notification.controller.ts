import type { Request, Response } from 'express';
import type {
  NotificationListQuery,
  NotificationPreferencesUpdateInput,
} from '@clinicos/validation';
import { ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError, ForbiddenError } from '../../shared/errors';
import { parsePagination } from '../../shared/pagination';
import * as service from './notification.service';

function requireTenant(req: Request): service.TenantScope {
  if (!req.tenant) throw new ForbiddenError('No clinic context.');
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId, branchId: req.tenant.branchId };
}

function requireUserId(req: Request) {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth.userId;
}

/** GET /notifications?unreadOnly=&category= — for req.auth.userId only, newest first, paginated. */
export async function list(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const userId = requireUserId(req);
  const filters = req.query as unknown as NotificationListQuery;
  const pagination = parsePagination(req);

  const { items, total } = await service.listNotifications(tenant, userId, filters, pagination);
  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

/** PATCH /notifications/:id/read — must belong to req.auth.userId (404 otherwise). */
export async function markRead(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const userId = requireUserId(req);
  const dto = await service.markRead(tenant, userId, req.params.id as string);
  await audit(req, { action: 'notification.read', resource: 'notification', resourceId: dto.id });
  ok(res, dto);
}

/** POST /notifications/mark-all-read — bulk update for req.auth.userId. */
export async function markAllRead(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const userId = requireUserId(req);
  const count = await service.markAllRead(tenant, userId);
  await audit(req, { action: 'notification.mark_all_read', resource: 'notification', after: { count } });
  ok(res, { updated: count });
}

/** GET /notifications/preferences */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const userId = requireUserId(req);
  const categories = await service.getPreferences(tenant, userId);
  ok(res, { categories });
}

/** PATCH /notifications/preferences */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const userId = requireUserId(req);
  const input = req.body as NotificationPreferencesUpdateInput;
  const categories = await service.updatePreferences(tenant, userId, input.categories);
  await audit(req, { action: 'notification.preferences_update', resource: 'notification_preference', after: { categories } });
  ok(res, { categories });
}

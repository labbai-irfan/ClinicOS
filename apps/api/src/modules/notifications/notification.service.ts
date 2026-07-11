import { Types } from 'mongoose';
import {
  SOCKET_EVENTS,
  type NotificationCategory,
  type NotificationDto,
  type NotificationPriority,
} from '@clinicos/types';
import type { Pagination } from '../../shared/pagination';
import { NotFoundError } from '../../shared/errors';
import { emitToUser } from '../../realtime/emit';
import {
  NotificationModel,
  NotificationPreferenceModel,
  defaultNotificationCategories,
  type NotificationDoc,
} from './notification.model';

/** Tenant scoping context, resolved by `tenantContext` middleware — never from client input. */
export interface TenantScope {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId?: Types.ObjectId;
}

export interface NotifyInput {
  userId: string | Types.ObjectId;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body?: string;
  link?: string;
}

export function toNotificationDto(doc: NotificationDoc): NotificationDto {
  return {
    id: doc._id.toString(),
    category: doc.category,
    priority: doc.priority,
    title: doc.title,
    body: doc.body,
    link: doc.link,
    read: doc.read,
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Reusable notification helper — creates the database record AND emits it in
 * real time to the recipient's personal room. This is the single entry point
 * other modules (queue check-in, emergency creation, billing, etc.) should
 * import to trigger a notification; it never needs the requesting user's own
 * permissions since it targets a *different* user (the notification recipient).
 */
export async function notify(tenant: TenantScope, input: NotifyInput): Promise<NotificationDto> {
  const userId = typeof input.userId === 'string' ? new Types.ObjectId(input.userId) : input.userId;

  const doc = await NotificationModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    userId,
    category: input.category,
    priority: input.priority,
    title: input.title,
    body: input.body,
    link: input.link,
    read: false,
  });

  const dto = toNotificationDto(doc);
  emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, dto);
  return dto;
}

export interface NotificationListFilter {
  unreadOnly?: boolean;
  category?: NotificationCategory;
}

/** Lists notifications for ONE user (req.auth.userId) — never clinic-wide. */
export async function listNotifications(
  tenant: TenantScope,
  userId: Types.ObjectId,
  filter: NotificationListFilter,
  pagination: Pagination,
): Promise<{ items: NotificationDto[]; total: number }> {
  const query: Record<string, unknown> = { clinicId: tenant.clinicId, userId, deletedAt: null };
  if (filter.unreadOnly) query.read = false;
  if (filter.category) query.category = filter.category;

  const [docs, total] = await Promise.all([
    NotificationModel.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    NotificationModel.countDocuments(query),
  ]);
  return { items: docs.map(toNotificationDto), total };
}

/** Marks one notification read. Scoped to clinic + owning user — 404s otherwise (never leaks existence). */
export async function markRead(
  tenant: TenantScope,
  userId: Types.ObjectId,
  id: string,
): Promise<NotificationDto> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Notification');
  const doc = await NotificationModel.findOneAndUpdate(
    { _id: id, clinicId: tenant.clinicId, userId, deletedAt: null },
    { $set: { read: true } },
    { new: true },
  );
  if (!doc) throw new NotFoundError('Notification');
  return toNotificationDto(doc);
}

/** Bulk-marks every unread notification for this user as read; returns the count updated. */
export async function markAllRead(tenant: TenantScope, userId: Types.ObjectId): Promise<number> {
  const result = await NotificationModel.updateMany(
    { clinicId: tenant.clinicId, userId, deletedAt: null, read: false },
    { $set: { read: true } },
  );
  return result.modifiedCount;
}

/** Gets (creating with all-true defaults on first access) this user's category preferences. */
export async function getPreferences(
  tenant: TenantScope,
  userId: Types.ObjectId,
): Promise<Record<NotificationCategory, boolean>> {
  const doc = await NotificationPreferenceModel.findOneAndUpdate(
    { clinicId: tenant.clinicId, userId },
    {
      $setOnInsert: {
        organizationId: tenant.organizationId,
        branchId: tenant.branchId,
        userId,
        categories: defaultNotificationCategories(),
      },
    },
    { new: true, upsert: true },
  );
  return doc.categories;
}

/** Merges a partial category patch onto the existing (or default) preferences and saves it. */
export async function updatePreferences(
  tenant: TenantScope,
  userId: Types.ObjectId,
  patch: Partial<Record<NotificationCategory, boolean>>,
): Promise<Record<NotificationCategory, boolean>> {
  const existing = await getPreferences(tenant, userId);
  const merged = { ...existing, ...patch };
  const doc = await NotificationPreferenceModel.findOneAndUpdate(
    { clinicId: tenant.clinicId, userId },
    { $set: { categories: merged } },
    { new: true },
  );
  return doc?.categories ?? merged;
}

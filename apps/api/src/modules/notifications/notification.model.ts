import { Schema, model, Types } from 'mongoose';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
  type NotificationCategory,
  type NotificationPriority,
} from '@clinicos/types';
import { tenantBase, type TenantFields } from '../../database/plugins';

/**
 * A single in-app notification (spec §27). Notifications are per-USER, not merely
 * per-clinic — a clinic can have many staff, each with their own inbox — so every
 * query MUST filter by both `clinicId` (tenant scope, from req.tenant) AND `userId`
 * (from req.auth.userId), never one without the other.
 */
export interface NotificationDoc extends TenantFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, required: true, default: 'normal' },
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true },
    link: { type: String, trim: true },
    read: { type: Boolean, required: true, default: false },
  },
  { collection: 'notifications' },
);

notificationSchema.plugin(tenantBase);

// Per-user inbox listing, newest first, with unread-only as a common filter.
notificationSchema.index({ clinicId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ clinicId: 1, userId: 1, read: 1, createdAt: -1 });

export const NotificationModel = model<NotificationDoc>('Notification', notificationSchema);

/**
 * Minimal per-user notification preferences: which categories a user wants to
 * receive. Kept deliberately small (spec §27) — one document per (clinic, user),
 * all categories default to `true` (opted in) until the user turns one off.
 */
export interface NotificationPreferenceDoc extends TenantFields {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  categories: Record<NotificationCategory, boolean>;
}

/** Every known category defaults to opted-in (`true`). */
export function defaultNotificationCategories(): Record<NotificationCategory, boolean> {
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, true])) as Record<
    NotificationCategory,
    boolean
  >;
}

const notificationPreferenceSchema = new Schema<NotificationPreferenceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    categories: { type: Schema.Types.Mixed, required: true, default: defaultNotificationCategories },
  },
  { collection: 'notificationPreferences' },
);

notificationPreferenceSchema.plugin(tenantBase);
notificationPreferenceSchema.index({ clinicId: 1, userId: 1 }, { unique: true });

export const NotificationPreferenceModel = model<NotificationPreferenceDoc>(
  'NotificationPreference',
  notificationPreferenceSchema,
);

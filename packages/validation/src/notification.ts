import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '@clinicos/types';

/** GET /notifications?unreadOnly=&category= — pagination (page/limit) handled separately. */
export const notificationListQuery = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
});
export type NotificationListQuery = z.infer<typeof notificationListQuery>;

/** PATCH /notifications/preferences — a partial map, only the toggled categories need be sent. */
export const notificationPreferencesUpdateSchema = z.object({
  categories: z.record(z.enum(NOTIFICATION_CATEGORIES), z.boolean()).refine(
    (value) => Object.keys(value).length > 0,
    'At least one category is required.',
  ),
});
export type NotificationPreferencesUpdateInput = z.infer<typeof notificationPreferencesUpdateSchema>;

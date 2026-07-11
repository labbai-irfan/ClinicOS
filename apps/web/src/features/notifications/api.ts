import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiSuccess, NotificationCategory, NotificationDto } from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import { apiClient } from '../../lib/api-client';
import { onSocketEvent } from '../../lib/realtime';

/** Base query-key prefix — every notifications query lives under this (spec §27). */
const NOTIFICATIONS_KEY = 'notifications' as const;

export interface NotificationListParams {
  unreadOnly?: boolean;
  category?: NotificationCategory;
  page?: number;
  limit?: number;
}

export interface NotificationListResult {
  items: NotificationDto[];
  page: number;
  limit: number;
  total: number;
}

export type NotificationPreferences = Record<NotificationCategory, boolean>;

function invalidateNotifications(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
}

/**
 * Subscribes to the `notification:new` realtime event and invalidates every
 * notifications query on receipt, so the inbox/unread badge refetch the
 * moment a new notification arrives for this user (server only emits to the
 * recipient's own `user:<id>` room — see `notify()` in the API module).
 */
function useRefetchOnNewNotification() {
  const queryClient = useQueryClient();
  useEffect(
    () => onSocketEvent(SOCKET_EVENTS.NOTIFICATION_NEW, () => invalidateNotifications(queryClient)),
    [queryClient],
  );
}

/** GET /notifications — the signed-in user's own inbox, newest first, paginated. */
export function useNotificationsQuery(params: NotificationListParams = {}) {
  useRefetchOnNewNotification();

  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'list', params] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<NotificationDto[]>>('/notifications', { params });
      return {
        items: data.data,
        page: data.meta.page ?? params.page ?? 1,
        limit: data.meta.limit ?? params.limit ?? data.data.length,
        total: data.meta.total ?? data.data.length,
      } satisfies NotificationListResult;
    },
    placeholderData: (previous) => previous,
  });
}

/** Lightweight unread count for chrome such as the header bell badge. */
export function useUnreadNotificationCountQuery(enabled = true) {
  useRefetchOnNewNotification();

  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'unread-count'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<NotificationDto[]>>('/notifications', {
        params: { unreadOnly: true, limit: 1 },
      });
      return data.meta.total ?? 0;
    },
    enabled,
    refetchInterval: 60_000,
  });
}

/** PATCH /notifications/:id/read */
export function useMarkReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<ApiSuccess<NotificationDto>>(`/notifications/${id}/read`);
      return data.data;
    },
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

/** POST /notifications/mark-all-read */
export function useMarkAllReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiSuccess<{ updated: number }>>('/notifications/mark-all-read');
      return data.data;
    },
    onSuccess: () => invalidateNotifications(queryClient),
  });
}

/** GET /notifications/preferences */
export function useNotificationPreferencesQuery() {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'preferences'] as const,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<{ categories: NotificationPreferences }>>(
        '/notifications/preferences',
      );
      return data.data.categories;
    },
  });
}

/** PATCH /notifications/preferences — send only the categories being toggled. */
export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (categories: Partial<NotificationPreferences>) => {
      const { data } = await apiClient.patch<ApiSuccess<{ categories: NotificationPreferences }>>(
        '/notifications/preferences',
        { categories },
      );
      return data.data.categories;
    },
    onSuccess: (categories) => {
      queryClient.setQueryData([NOTIFICATIONS_KEY, 'preferences'], categories);
    },
  });
}

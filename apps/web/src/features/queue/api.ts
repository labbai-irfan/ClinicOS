import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApiSuccess, QueueEntryChangedPayload, QueueEntryDto, QueueStatus } from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import type {
  AddToQueueInput,
  QueueTransitionInput,
  callPatientSchema,
  queueRejoinSchema,
  queueSkipSchema,
} from '@clinicos/validation';
import type { z } from 'zod';
import { apiClient } from '../../lib/api-client';
import { onSocketEvent } from '../../lib/realtime';
import { useAuthStore } from '../../stores/auth-store';

export type QueueBoardView = 'board' | 'list';

export type QueueSkipInput = z.infer<typeof queueSkipSchema>;
export type QueueRejoinInput = z.infer<typeof queueRejoinSchema>;
export type QueueCallInput = z.infer<typeof callPatientSchema>;

/** Base query-key prefix — mutations invalidate every board/list query under this. */
const QUEUE_QUERY_ROOT = ['queue', 'board'] as const;

function invalidateBoard(queryClient: QueryClient, activeBranchId: string | null) {
  void queryClient.invalidateQueries({ queryKey: [...QUEUE_QUERY_ROOT, activeBranchId] });
}

/**
 * Live queue board/list for the active branch + date. Polls every 15s as a fallback
 * and subscribes to the queue socket events so the board updates immediately when any
 * staff member (or this session) changes an entry.
 */
export function useQueueBoardQuery(date: string, view: QueueBoardView = 'board') {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const queryClient = useQueryClient();
  const queryKey = [...QUEUE_QUERY_ROOT, activeBranchId, date, view] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<QueueEntryDto[]>>('/queues', {
        params: { view, date },
      });
      return data.data;
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const invalidate = () => invalidateBoard(queryClient, activeBranchId);
    const unsubscribers = [
      onSocketEvent(SOCKET_EVENTS.QUEUE_UPDATED, invalidate),
      onSocketEvent<QueueEntryChangedPayload>(SOCKET_EVENTS.QUEUE_ENTRY_CHANGED, invalidate),
      onSocketEvent(SOCKET_EVENTS.QUEUE_CALLED, invalidate),
      onSocketEvent(SOCKET_EVENTS.QUEUE_DELAYED, invalidate),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [queryClient, activeBranchId]);

  return query;
}

export function useAddToQueueMutation() {
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation({
    mutationFn: async (input: AddToQueueInput) => {
      const { data } = await apiClient.post<ApiSuccess<QueueEntryDto>>('/queues', input);
      return data.data;
    },
    onSuccess: () => invalidateBoard(queryClient, activeBranchId),
  });
}

export function useTransitionMutation() {
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: { id: string } & QueueTransitionInput & { to: QueueStatus }) => {
      const { data } = await apiClient.patch<ApiSuccess<QueueEntryDto>>(
        `/queues/${id}/transition`,
        input,
      );
      return data.data;
    },
    onSuccess: () => invalidateBoard(queryClient, activeBranchId),
  });
}

export function useSkipMutation() {
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & QueueSkipInput) => {
      const { data } = await apiClient.post<ApiSuccess<QueueEntryDto>>(`/queues/${id}/skip`, input);
      return data.data;
    },
    onSuccess: () => invalidateBoard(queryClient, activeBranchId),
  });
}

export function useRejoinMutation() {
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & QueueRejoinInput) => {
      const { data } = await apiClient.post<ApiSuccess<QueueEntryDto>>(`/queues/${id}/rejoin`, input);
      return data.data;
    },
    onSuccess: () => invalidateBoard(queryClient, activeBranchId),
  });
}

export function useCallPatientMutation() {
  const queryClient = useQueryClient();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & QueueCallInput) => {
      const { data } = await apiClient.post<ApiSuccess<QueueEntryDto>>(`/queues/${id}/call`, input);
      return data.data;
    },
    onSuccess: () => invalidateBoard(queryClient, activeBranchId),
  });
}

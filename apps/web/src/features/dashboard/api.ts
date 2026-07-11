import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiSuccess, ClinicDto, DashboardSummaryDto } from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import { apiClient } from '../../lib/api-client';
import { onSocketEvent } from '../../lib/realtime';
import { useAuthStore } from '../../stores/auth-store';

const REFRESH_INTERVAL_MS = 30_000;

/** Realtime events that can move any dashboard KPI (queue counts, wait time, emergencies). */
const INVALIDATING_EVENTS = [
  SOCKET_EVENTS.QUEUE_UPDATED,
  SOCKET_EVENTS.QUEUE_ENTRY_CHANGED,
  SOCKET_EVENTS.QUEUE_CALLED,
  SOCKET_EVENTS.QUEUE_DELAYED,
  SOCKET_EVENTS.APPOINTMENT_CHANGED,
  SOCKET_EVENTS.EMERGENCY_CREATED,
  SOCKET_EVENTS.EMERGENCY_UPDATED,
] as const;

export function dashboardSummaryKey(branchId: string | null) {
  return ['dashboard', 'summary', branchId ?? 'all'] as const;
}

/**
 * Loads the GET /dashboard/summary snapshot (spec §10). Refetches on a 30s
 * timer for staff who leave the tab open, and also invalidates immediately on
 * queue/appointment/emergency realtime events so the numbers feel live.
 */
export function useDashboardSummaryQuery() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribers = INVALIDATING_EVENTS.map((event) =>
      onSocketEvent(event, () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      }),
    );
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [queryClient]);

  return useQuery({
    queryKey: dashboardSummaryKey(activeBranchId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<DashboardSummaryDto>>('/dashboard/summary');
      return data.data;
    },
    refetchInterval: REFRESH_INTERVAL_MS,
    staleTime: 15_000,
  });
}

/**
 * Clinic display name for the page header greeting. Decorative only — the
 * auth store carries clinicId/branchIds (never a display name), so this reads
 * the real `ClinicDto.name` field. Kept non-blocking with retry disabled: if
 * the caller's role can't reach this endpoint the header simply omits the
 * clinic name rather than showing an error for a non-essential label.
 */
export function useClinicNameQuery() {
  return useQuery({
    queryKey: ['dashboard', 'clinic-name'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<Pick<ClinicDto, 'name'>>>('/clinics/me');
      return data.data;
    },
    staleTime: 5 * 60_000,
    retry: 0,
  });
}

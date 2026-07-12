import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ApiSuccess, EmergencyCaseDto, EmergencyStatus, StaffDto } from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import type {
  createEmergencySchema,
  emergencyAssignSchema,
  emergencyObservationSchema,
  emergencyReferralSchema,
  emergencyTransitionSchema,
  emergencyTriageSchema,
} from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';
import { onSocketEvent } from '../../lib/realtime';

export type CreateEmergencyInput = z.infer<typeof createEmergencySchema>;
export type TriageInput = z.infer<typeof emergencyTriageSchema>;
export type TransitionInput = z.infer<typeof emergencyTransitionSchema>;
export type AssignInput = z.infer<typeof emergencyAssignSchema>;
export type ReferralInput = z.infer<typeof emergencyReferralSchema>;
export type ObservationInput = z.infer<typeof emergencyObservationSchema>;

/** Shape returned by GET /emergencies/:id/events (apps/api emergency.service EmergencyEventSummary). */
export interface EmergencyEventDto {
  id: string;
  action: string;
  fromStatus?: EmergencyStatus;
  toStatus?: EmergencyStatus;
  actorUserId?: string;
  actorName?: string;
  notes?: string;
  createdAt: string;
}

const BOARD_ROOT_KEY = ['emergency', 'board'] as const;
const boardKey = (status?: EmergencyStatus) => [...BOARD_ROOT_KEY, status ?? 'active'] as const;
const caseKey = (id: string) => ['emergency', 'case', id] as const;
const eventsKey = (id: string) => ['emergency', 'case', id, 'events'] as const;

/** Realtime events that should invalidate the board (spec §20: board reacts live to arrivals/changes). */
function useBoardRealtimeInvalidation() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: BOARD_ROOT_KEY });
    const offCreated = onSocketEvent(SOCKET_EVENTS.EMERGENCY_CREATED, invalidate);
    const offUpdated = onSocketEvent(SOCKET_EVENTS.EMERGENCY_UPDATED, invalidate);
    const offAlert = onSocketEvent(SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT, invalidate);
    return () => {
      offCreated();
      offUpdated();
      offAlert();
    };
  }, [queryClient]);
}

/** Emergency board (spec §20) — polls as a safety net and refreshes instantly on socket events. */
export function useEmergencyBoardQuery(status?: EmergencyStatus) {
  useBoardRealtimeInvalidation();

  return useQuery({
    queryKey: boardKey(status),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<EmergencyCaseDto[]>>('/emergencies', {
        params: status ? { status } : undefined,
      });
      return data.data;
    },
    refetchInterval: 15_000,
  });
}

export function useEmergencyCaseQuery(caseId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!caseId) return undefined;
    const invalidate = (payload: { id: string }) => {
      if (payload.id === caseId) queryClient.invalidateQueries({ queryKey: caseKey(caseId) });
    };
    const offUpdated = onSocketEvent<EmergencyCaseDto>(SOCKET_EVENTS.EMERGENCY_UPDATED, invalidate);
    const offAlert = onSocketEvent<EmergencyCaseDto>(SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT, invalidate);
    return () => {
      offUpdated();
      offAlert();
    };
  }, [caseId, queryClient]);

  return useQuery({
    queryKey: caseKey(caseId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<EmergencyCaseDto>>(`/emergencies/${caseId}`);
      return data.data;
    },
    enabled: !!caseId,
    refetchInterval: 20_000,
  });
}

/**
 * Case timeline. Built defensively: if the events endpoint isn't reachable yet, this
 * fails once (no retry storm) and callers should render a graceful empty state.
 */
export function useEmergencyEventsQuery(caseId: string | undefined) {
  return useQuery({
    queryKey: eventsKey(caseId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<EmergencyEventDto[]>>(
        `/emergencies/${caseId}/events`,
      );
      return data.data;
    },
    enabled: !!caseId,
    retry: false,
  });
}

/**
 * Doctor/nurse directory for the Assign panel. Built defensively: the staff module may
 * not be reachable yet, so this fails once and callers fall back to a graceful state.
 */
export function useStaffDirectoryQuery() {
  return useQuery({
    queryKey: ['staff', 'directory'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<StaffDto[]>>('/staff', {
        params: { limit: 100 },
      });
      return data.data;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useCreateEmergencyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEmergencyInput) => {
      const { data } = await apiClient.post<ApiSuccess<EmergencyCaseDto>>('/emergencies', input);
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(caseKey(dto.id), dto);
      queryClient.invalidateQueries({ queryKey: BOARD_ROOT_KEY });
    },
  });
}

function useCaseMutation<TInput>(caseId: string, path: string, action: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => {
      const { data } = await apiClient.post<ApiSuccess<EmergencyCaseDto>>(
        `/emergencies/${caseId}/${path}`,
        input,
      );
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(caseKey(caseId), dto);
      queryClient.invalidateQueries({ queryKey: BOARD_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: eventsKey(caseId) });
    },
    meta: { action },
  });
}

export function useTriageMutation(caseId: string) {
  return useCaseMutation<TriageInput>(caseId, 'triage', 'triage');
}

export function useAssignMutation(caseId: string) {
  return useCaseMutation<AssignInput>(caseId, 'assign', 'assign');
}

export function useReferralMutation(caseId: string) {
  return useCaseMutation<ReferralInput>(caseId, 'referral', 'referral');
}

export function useObservationMutation(caseId: string) {
  return useCaseMutation<ObservationInput>(caseId, 'observation', 'observation');
}

/** Status transitions use PATCH .../status, unlike the other case actions (POST). */
export function useTransitionMutation(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransitionInput) => {
      const { data } = await apiClient.patch<ApiSuccess<EmergencyCaseDto>>(
        `/emergencies/${caseId}/status`,
        input,
      );
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(caseKey(caseId), dto);
      queryClient.invalidateQueries({ queryKey: BOARD_ROOT_KEY });
      queryClient.invalidateQueries({ queryKey: eventsKey(caseId) });
    },
  });
}

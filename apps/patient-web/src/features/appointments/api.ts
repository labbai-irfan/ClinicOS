import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import type { ApiFailure, ApiSuccess, AppointmentDto, AppointmentStatus, PatientDto, StaffDto } from '@clinicos/types';
import { rescheduleAppointmentSchema, type CreateAppointmentInput } from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

const APPOINTMENTS_KEY = 'appointments';

export interface AppointmentListParams {
  date?: string;
  from?: string;
  to?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
}

/** GET /appointments — list within a date, range, doctor, patient, and/or status filter. */
export function useAppointmentsQuery(params: AppointmentListParams) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<AppointmentDto[]>>('/appointments', {
        params: { limit: 100, ...params },
      });
      return data.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** GET /schedules/available-slots response shape — no shared DTO exists yet, kept local to
 *  this feature (mirrors how other features handle endpoints without a published DTO). */
export interface AvailableSlotDto {
  windowStart: string;
  windowEnd: string;
  capacity: number;
  bookedCount: number;
  available: boolean;
}

export interface AvailableSlotsParams {
  doctorId?: string;
  date?: string;
  branchId?: string;
}

export function useAvailableSlotsQuery(params: AvailableSlotsParams) {
  const enabled = Boolean(params.doctorId && params.date);
  return useQuery({
    queryKey: ['schedules', 'available-slots', params.doctorId, params.date, params.branchId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<AvailableSlotDto[]>>('/schedules/available-slots', {
        params,
      });
      return data.data;
    },
    enabled,
    staleTime: 15_000,
  });
}

/**
 * Doctor directory for the appointment form's doctor select. Deliberately tolerant of the
 * endpoint being unreachable (module still being built, or the caller's role lacking
 * `staff.manage`) — callers fall back to a free-text input on `isError`, per spec.
 */
export function useDoctorsQuery() {
  return useQuery({
    queryKey: ['staff', 'doctors'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<StaffDto[]>>('/staff', {
        params: { roleKey: 'doctor' },
      });
      return data.data.filter((staff) => staff.roleKey === 'doctor' && staff.isActive);
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** GET /patients?q= — used by the patient picker in the New Appointment dialog. */
export function usePatientSearchQuery(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['patients', 'search', q],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<PatientDto[]>>('/patients', {
        params: { q, limit: 8 },
      });
      return data.data;
    },
    enabled: q.length >= 2,
    staleTime: 10_000,
  });
}

export function useCreateAppointmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const { data } = await apiClient.post<ApiSuccess<AppointmentDto>>('/appointments', input);
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
    },
  });
}

export function useRescheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RescheduleAppointmentInput }) => {
      const { data } = await apiClient.patch<ApiSuccess<AppointmentDto>>(
        `/appointments/${id}/reschedule`,
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
    },
  });
}

export function useStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: AppointmentStatus; reason?: string }) => {
      const { data } = await apiClient.patch<ApiSuccess<AppointmentDto>>(`/appointments/${id}/status`, {
        status,
        reason,
      });
      return data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
    },
  });
}

/** Extracts the API error code (e.g. `DOUBLE_BOOKING`) from a failed request, if any. */
export function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<ApiFailure>(error)) return error.response?.data?.error?.code;
  return undefined;
}

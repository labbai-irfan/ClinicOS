import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { ApiSuccess, PatientDto } from '@clinicos/types';
import {
  mergePatientsSchema,
  type QuickRegisterPatientInput,
  type UpdatePatientInput,
} from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';

/**
 * `GET /patients/check-duplicates` candidate shape — mirrors
 * `apps/api/src/modules/patients/patient.service.ts` `PatientDuplicateCandidateDto`.
 * Not promoted to `@clinicos/types` yet, so kept local to this feature (same
 * pattern as `onboarding/api.ts`).
 */
export interface PatientDuplicateCandidateDto {
  id: string;
  code: string;
  fullName: string;
  mobile?: string;
  dateOfBirth?: string;
}

/** `GET /patients/:id` shape: the shared `PatientDto` plus a server-computed age. */
export interface PatientProfileDto extends PatientDto {
  age?: number;
}

export type MergePatientsInput = z.infer<typeof mergePatientsSchema>;

export interface PatientListParams {
  q?: string;
  mobile?: string;
  code?: string;
  dateOfBirth?: string;
  page?: number;
  limit?: number;
}

export interface PatientListResult {
  items: PatientDto[];
  page: number;
  limit: number;
  total: number;
}

export interface DuplicateCheckParams {
  mobile?: string;
  fullName?: string;
  dateOfBirth?: string;
}

const PATIENTS_KEY = 'patients' as const;

export function usePatientsQuery(params: PatientListParams) {
  return useQuery({
    queryKey: [PATIENTS_KEY, 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<PatientDto[]>>('/patients', { params });
      return {
        items: data.data,
        page: data.meta.page ?? params.page ?? 1,
        limit: data.meta.limit ?? params.limit ?? data.data.length,
        total: data.meta.total ?? data.data.length,
      } satisfies PatientListResult;
    },
    placeholderData: (previous) => previous,
  });
}

/** Non-blocking duplicate lookup (spec §12) — caller decides when there is "enough input". */
export function useCheckDuplicatesQuery(params: DuplicateCheckParams, enabled: boolean) {
  return useQuery({
    queryKey: [PATIENTS_KEY, 'duplicates', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<PatientDuplicateCandidateDto[]>>(
        '/patients/check-duplicates',
        { params },
      );
      return data.data;
    },
    enabled,
    staleTime: 10_000,
    retry: 0,
  });
}

export function useCreatePatientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: QuickRegisterPatientInput) => {
      const { data } = await apiClient.post<ApiSuccess<PatientDto>>('/patients', input);
      const duplicateWarnings =
        (data.meta.duplicateWarnings as PatientDuplicateCandidateDto[] | undefined) ?? [];
      return { patient: data.data, duplicateWarnings };
    },
    onSuccess: ({ patient }) => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY, 'list'] });
      queryClient.setQueryData([PATIENTS_KEY, 'detail', patient.id], patient);
    },
  });
}

export function usePatientQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: [PATIENTS_KEY, 'detail', patientId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<PatientProfileDto>>(`/patients/${patientId}`);
      return data.data;
    },
    enabled: !!patientId,
    // A 404 here is a definitive "no such patient" — don't burn time retrying it.
    retry: false,
  });
}

export function useUpdatePatientMutation(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePatientInput) => {
      const { data } = await apiClient.patch<ApiSuccess<PatientDto>>(`/patients/${patientId}`, input);
      return data.data;
    },
    onSuccess: (patient) => {
      queryClient.setQueryData(
        [PATIENTS_KEY, 'detail', patientId],
        (previous: PatientProfileDto | undefined) =>
          previous ? { ...previous, ...patient } : patient,
      );
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY, 'list'] });
    },
  });
}

export function useMergePatientsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MergePatientsInput) => {
      const { data } = await apiClient.post<ApiSuccess<{ primary: PatientDto; duplicate: PatientDto }>>(
        '/patients/merge',
        input,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
    },
  });
}

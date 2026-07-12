import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiSuccess, BranchDto, ClinicDto, RejoinPolicy, StaffDto } from '@clinicos/types';
import type { InviteStaffInput } from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';
import type { AddressContactInput, ClinicIdentityInput, PrescriptionBrandingInput } from './schemas';

/** GET /clinics/me shape: the shared `ClinicDto` plus fields that live on the same
 *  Clinic document but aren't in the shared DTO yet (prescription branding). */
export interface ClinicRecord extends ClinicDto {
  prescriptionHeader?: string;
  prescriptionFooter?: string;
}

/** Body accepted by PATCH /clinics/me — identity fields (step 1) and/or prescription
 *  branding (step 7), both persisted directly on the Clinic document. */
export type UpdateClinicInput = Partial<ClinicIdentityInput> & Partial<PrescriptionBrandingInput>;

/** Body accepted by PATCH /settings/clinic (step 6 — appointment window/buffer +
 *  rejoin policy). Field names must match `updateClinicSettingsSchema` on the
 *  backend exactly (packages/validation/src/tenancy.ts); unknown keys are
 *  silently stripped there rather than rejected, so a mismatch here loses data
 *  silently. There is no clinic-wide "default consultation fee" field on this
 *  (or any) resource — fees are per-doctor (see ConsultationFeeStep). */
export interface UpdateClinicSettingsInput {
  appointmentWindowMinutes?: number;
  appointmentBufferMinutes?: number;
  rejoinPolicy?: RejoinPolicy;
}

const CLINIC_QUERY_KEY = ['onboarding', 'clinic'] as const;

export function useClinicQuery() {
  return useQuery({
    queryKey: CLINIC_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<ClinicRecord>>('/clinics/me');
      return data.data;
    },
    staleTime: 10_000,
  });
}

export function useUpdateClinicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateClinicInput) => {
      const { data } = await apiClient.patch<ApiSuccess<ClinicRecord>>('/clinics/me', input);
      return data.data;
    },
    onSuccess: (clinic) => {
      queryClient.setQueryData(CLINIC_QUERY_KEY, clinic);
    },
  });
}

export function useUpdateClinicSettingsMutation() {
  return useMutation({
    mutationFn: async (input: UpdateClinicSettingsInput) => {
      const { data } = await apiClient.patch<ApiSuccess<UpdateClinicSettingsInput>>(
        '/settings/clinic',
        input,
      );
      return data.data;
    },
  });
}

export function useUpdateBranchMutation() {
  return useMutation({
    mutationFn: async ({
      branchId,
      input,
    }: {
      branchId: string;
      input: Partial<AddressContactInput> & { workingHours?: BranchDto['workingHours'] };
    }) => {
      const { data } = await apiClient.patch<ApiSuccess<BranchDto>>(`/branches/${branchId}`, input);
      return data.data;
    },
  });
}

export function useInviteStaffMutation() {
  return useMutation({
    mutationFn: async (input: InviteStaffInput) => {
      const { data } = await apiClient.post<ApiSuccess<StaffDto>>('/staff', input);
      return data.data;
    },
  });
}

export function useAdvanceOnboardingStepMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (step: number) => {
      const { data } = await apiClient.patch<ApiSuccess<ClinicRecord>>('/clinics/me/onboarding-step', {
        step,
      });
      return data.data;
    },
    onSuccess: (clinic) => {
      queryClient.setQueryData(CLINIC_QUERY_KEY, clinic);
    },
  });
}

export function useActivateClinicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiSuccess<ClinicRecord>>('/clinics/me/activate', {});
      return data.data;
    },
    onSuccess: (clinic) => {
      queryClient.setQueryData(CLINIC_QUERY_KEY, clinic);
    },
  });
}

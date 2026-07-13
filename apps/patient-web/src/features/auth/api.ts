import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiSuccess, LoginResponseDto } from '@clinicos/types';
import type { LoginPatientInput, RegisterPatientInput } from '@clinicos/validation';
import { patientApiClient } from '../../lib/api-client-patient';
import { usePatientAuthStore } from '../../stores/auth-store-patient';

export interface PublicClinicOption {
  id: string;
  name: string;
}

/** GET /patient/auth/clinics — public, no auth. Powers the clinic picker at signup. */
export function useClinicsSearchQuery(q: string) {
  return useQuery({
    queryKey: ['auth', 'clinics', q],
    queryFn: async () => {
      const { data } = await patientApiClient.get<ApiSuccess<PublicClinicOption[]>>('/auth/clinics', {
        params: q ? { q } : undefined,
      });
      return data.data;
    },
    staleTime: 30_000,
  });
}

function applyPatientSession(data: LoginResponseDto) {
  usePatientAuthStore.getState().setSession({
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
}

export function useLoginPatientMutation() {
  return useMutation({
    mutationFn: async (input: LoginPatientInput) => {
      const { data } = await patientApiClient.post<ApiSuccess<LoginResponseDto>>(
        '/auth/login-patient',
        input,
      );
      return data.data;
    },
    onSuccess: applyPatientSession,
  });
}

export function useRegisterPatientMutation() {
  return useMutation({
    mutationFn: async (input: RegisterPatientInput) => {
      const { data } = await patientApiClient.post<ApiSuccess<LoginResponseDto>>(
        '/auth/register-patient',
        input,
      );
      return data.data;
    },
    onSuccess: applyPatientSession,
  });
}

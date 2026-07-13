import { useMutation } from '@tanstack/react-query';
import type { ApiSuccess, LoginResponseDto } from '@clinicos/types';
import type { LoginPatientInput, RegisterPatientInput } from '@clinicos/validation';
import { patientApiClient } from '../../lib/api-client-patient';
import { usePatientAuthStore } from '../../stores/auth-store-patient';

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

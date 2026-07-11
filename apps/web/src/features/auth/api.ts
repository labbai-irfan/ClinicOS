import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiSuccess, LoginResponseDto } from '@clinicos/types';
import type { LoginInput, RegisterOwnerInput } from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { connectSocket, disconnectSocket } from '../../lib/realtime';

function applySession(data: LoginResponseDto) {
  useAuthStore.getState().setSession(data);
  connectSocket();
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await apiClient.post<ApiSuccess<LoginResponseDto>>('/auth/login', input);
      return data.data;
    },
    onSuccess: applySession,
  });
}

export function useRegisterOwnerMutation() {
  return useMutation({
    mutationFn: async (input: RegisterOwnerInput) => {
      const { data } = await apiClient.post<ApiSuccess<LoginResponseDto>>(
        '/auth/register-owner',
        input,
      );
      return data.data;
    },
    onSuccess: applySession,
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      useAuthStore.getState().clear();
      disconnectSocket();
      queryClient.clear();
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post<ApiSuccess<{ message: string }>>(
        '/auth/forgot-password',
        { email },
      );
      return data.data;
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await apiClient.post<ApiSuccess<{ message: string }>>(
        '/auth/reset-password',
        input,
      );
      return data.data;
    },
  });
}

export function useMeQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<{ user: LoginResponseDto['user']; onboardingComplete: boolean }>>(
        '/auth/me',
      );
      return data.data;
    },
    enabled,
    staleTime: 60_000,
  });
}

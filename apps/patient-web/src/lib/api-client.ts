import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure } from '@clinicos/types';
import { useAuthStore } from '../stores/auth-store';
import { isNativeApp } from './platform';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // send the httpOnly refresh cookie on web
  headers: isNativeApp() ? { 'X-Client-Type': 'native' } : undefined,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken, activeBranchId } = useAuthStore.getState();
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  if (activeBranchId) config.headers.set('X-Branch-Id', activeBranchId);
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, user, onboardingComplete } = useAuthStore.getState();
  try {
    const { data } = await axios.post<{ data: { accessToken: string; refreshToken?: string } }>(
      `${API_URL}/api/v1/auth/refresh`,
      isNativeApp() && refreshToken ? { refreshToken } : {},
      {
        withCredentials: true,
        headers: isNativeApp() ? { 'X-Client-Type': 'native' } : undefined,
      },
    );
    useAuthStore.getState().setSession({
      user: user!,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
      onboardingComplete,
    });
    return data.data.accessToken;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiFailure>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    if (status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried) {
      original._retried = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(original);
      }
    }

    return Promise.reject(error);
  },
);

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<ApiFailure>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }
  return fallback;
}

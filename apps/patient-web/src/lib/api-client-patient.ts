import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure } from '@clinicos/types';
import { usePatientAuthStore } from '../stores/auth-store-patient';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const patientApiClient = axios.create({
  baseURL: `${API_URL}/api/v1/patient`,
  withCredentials: true,
});

patientApiClient.interceptors.request.use((config) => {
  const { accessToken } = usePatientAuthStore.getState();
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, userId, name, email } = usePatientAuthStore.getState();
  try {
    const { data } = await axios.post<{ data: { accessToken: string; refreshToken?: string } }>(
      `${API_URL}/api/v1/patient/auth/refresh-patient`,
      { refreshToken },
      {
        withCredentials: true,
      },
    );
    usePatientAuthStore.getState().setSession({
      userId: userId!,
      name: name!,
      email: email!,
      accessToken: data.data.accessToken,
      refreshToken: data.data.refreshToken,
    });
    return data.data.accessToken;
  } catch {
    usePatientAuthStore.getState().logout();
    return null;
  }
}

patientApiClient.interceptors.response.use(
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
        return patientApiClient(original);
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

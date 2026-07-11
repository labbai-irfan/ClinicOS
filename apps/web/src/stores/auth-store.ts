import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUserDto } from '@clinicos/types';
import { isNativeApp } from '../lib/platform';

interface AuthState {
  user: AuthUserDto | null;
  accessToken: string | null;
  /** Only ever populated on native clients (ADR-16); web relies on the httpOnly cookie. */
  refreshToken: string | null;
  activeBranchId: string | null;
  onboardingComplete: boolean;
  setSession: (input: {
    user: AuthUserDto;
    accessToken: string;
    refreshToken?: string;
    onboardingComplete: boolean;
  }) => void;
  setAccessToken: (token: string) => void;
  setActiveBranch: (branchId: string) => void;
  clear: () => void;
}

/**
 * Session state. On web, only the access token lives here (in memory + persisted
 * storage for reload continuity); the refresh token never leaves the httpOnly
 * cookie. On native, the refresh token is intentionally persisted so the app can
 * silently restore a session after the process is killed and relaunched.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      activeBranchId: null,
      onboardingComplete: false,
      setSession: ({ user, accessToken, refreshToken, onboardingComplete }) =>
        set({
          user,
          accessToken,
          refreshToken: refreshToken ?? null,
          activeBranchId: user.activeBranchId,
          onboardingComplete,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setActiveBranch: (activeBranchId) => set({ activeBranchId }),
      clear: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          activeBranchId: null,
          onboardingComplete: false,
        }),
    }),
    {
      name: 'clinicos.auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: isNativeApp() ? state.refreshToken : null,
        activeBranchId: state.activeBranchId,
        onboardingComplete: state.onboardingComplete,
      }),
    },
  ),
);

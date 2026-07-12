import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PatientAuthState {
  userId: string | null;
  name: string | null;
  email: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  setSession: (input: {
    userId: string;
    name: string;
    email: string;
    accessToken: string;
    refreshToken?: string;
  }) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

/**
 * Patient authentication store using Zustand.
 * Manages patient session state including userId, name, email, and tokens.
 */
export const usePatientAuthStore = create<PatientAuthState>()(
  persist(
    (set) => ({
      userId: null,
      name: null,
      email: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      setSession: ({ userId, name, email, accessToken, refreshToken }) =>
        set({
          userId,
          name,
          email,
          accessToken,
          refreshToken: refreshToken ?? null,
          isLoggedIn: true,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () =>
        set({
          userId: null,
          name: null,
          email: null,
          accessToken: null,
          refreshToken: null,
          isLoggedIn: false,
        }),
    }),
    {
      name: 'clinicos.patient-auth',
      partialize: (state) => ({
        userId: state.userId,
        name: state.name,
        email: state.email,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
);

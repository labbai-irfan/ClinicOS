import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

export function RequireAuth({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const onboardingComplete = useAuthStore((s) => s.onboardingComplete);
  const roleKey = useAuthStore((s) => s.user?.roleKey);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  const exemptFromOnboarding = location.pathname.startsWith('/onboarding');
  if (!onboardingComplete && roleKey === 'clinic_owner' && !exemptFromOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

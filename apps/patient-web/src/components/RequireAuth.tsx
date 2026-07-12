import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePatientAuthStore } from '../stores/auth-store-patient';

export function RequireAuth({ children }: { children: ReactNode }) {
  const accessToken = usePatientAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const accessToken = usePatientAuthStore((s) => s.accessToken);
  if (accessToken) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

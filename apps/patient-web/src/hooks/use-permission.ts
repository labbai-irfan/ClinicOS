import { useMemo } from 'react';
import type { Permission } from '@clinicos/types';
import { useAuthStore } from '../stores/auth-store';

/**
 * Frontend permission check for NAVIGATION AND UX ONLY (hide/show, disable
 * actions before a doomed request). The backend re-checks every permission on
 * every route (`authorize()` middleware) — this is never the security boundary.
 */
export function usePermission(): {
  has: (permission: Permission) => boolean;
  hasAny: (...permissions: Permission[]) => boolean;
} {
  const permissions = useAuthStore((s) => s.user?.permissions);
  const set = useMemo(() => new Set(permissions ?? []), [permissions]);
  return {
    has: (permission) => set.has(permission),
    hasAny: (...perms) => perms.some((p) => set.has(p)),
  };
}

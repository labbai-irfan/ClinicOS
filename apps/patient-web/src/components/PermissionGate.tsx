import type { ReactNode } from 'react';
import type { Permission } from '@clinicos/types';
import { usePermission } from '../hooks/use-permission';
import { PermissionDenied } from './ui/PermissionDenied';

/** Route-level guard: renders PermissionDenied instead of the page when the permission is missing. */
export function PermissionGate({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { has } = usePermission();
  if (!has(permission)) return <PermissionDenied />;
  return <>{children}</>;
}

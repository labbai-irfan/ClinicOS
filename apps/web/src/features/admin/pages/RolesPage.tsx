import { Fragment, useEffect, useMemo, useState } from 'react';
import { Check, Lock, Save, Undo2 } from 'lucide-react';
import { ALL_PERMISSIONS, PERMISSIONS, type Permission } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { CLINIC_ROLE_KEYS, groupPermissions, permissionActionLabel, permissionGroupLabel, ROLE_LABELS } from '../labels';
import { type RoleDto, useRolesQuery, useUpdateRolePermissionsMutation } from '../api';

const GROUPS = groupPermissions(ALL_PERMISSIONS);

function sameSet(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((p) => setB.has(p));
}

export default function RolesPage() {
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.ROLE_MANAGE);

  const { data: roles, isLoading, isError, refetch } = useRolesQuery();
  const updatePermissions = useUpdateRolePermissionsMutation();

  const [draft, setDraft] = useState<Record<string, Permission[]>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [mobileRoleId, setMobileRoleId] = useState<string>('');

  useEffect(() => {
    if (!roles) return;
    setDraft((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const role of roles) {
        if (!(role.id in next)) {
          next[role.id] = role.permissions;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setMobileRoleId((prev) => prev || roles.find((r) => CLINIC_ROLE_KEYS.includes(r.key))?.id || '');
  }, [roles]);

  const clinicRoles = useMemo(
    () =>
      (roles ?? [])
        .filter((r) => CLINIC_ROLE_KEYS.includes(r.key))
        .sort((a, b) => CLINIC_ROLE_KEYS.indexOf(a.key) - CLINIC_ROLE_KEYS.indexOf(b.key)),
    [roles],
  );
  const rolesById = useMemo(() => new Map((roles ?? []).map((r) => [r.id, r])), [roles]);

  function isChecked(roleId: string, permission: Permission): boolean {
    return draft[roleId]?.includes(permission) ?? false;
  }

  function toggle(roleId: string, permission: Permission) {
    setDraft((prev) => {
      const current = prev[roleId] ?? [];
      const next = current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission];
      return { ...prev, [roleId]: next };
    });
  }

  function isDirty(roleId: string): boolean {
    const role = rolesById.get(roleId);
    if (!role) return false;
    const current = draft[roleId] ?? role.permissions;
    return !sameSet(current, role.permissions);
  }

  function discard(roleId: string) {
    const role = rolesById.get(roleId);
    if (!role) return;
    setDraft((prev) => ({ ...prev, [roleId]: role.permissions }));
    setReasons((prev) => ({ ...prev, [roleId]: '' }));
  }

  function save(role: RoleDto) {
    const permissions = draft[role.id] ?? role.permissions;
    const reason = (reasons[role.id] ?? '').trim();
    if (!reason) return;
    updatePermissions.mutate(
      { roleId: role.id, permissions, reason },
      {
        onSuccess: () => {
          toast.success('Permissions updated', `${ROLE_LABELS[role.key]} permissions saved.`);
          setReasons((prev) => ({ ...prev, [role.id]: '' }));
        },
        onError: (err) => toast.error('Could not save permissions', apiErrorMessage(err)),
      },
    );
  }

  const dirtyRoles = clinicRoles.filter((r) => isDirty(r.id));

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        description="Control what each role can see and do. Permission changes require a short reason and are audited."
      />

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={roles}
        onRetry={() => void refetch()}
        isEmpty={(d) => d.filter((r) => CLINIC_ROLE_KEYS.includes(r.key)).length === 0}
        emptyTitle="No roles configured yet"
      >
        {() => (
          <>
            {/* Desktop matrix */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="sticky left-0 z-10 bg-surface px-4 py-3">Permission</th>
                    {clinicRoles.map((role) => (
                      <th key={role.id} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>{ROLE_LABELS[role.key]}</span>
                          {role.isSystem && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-normal normal-case text-text-secondary">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              System
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map(([group, permissions]) => (
                    <Fragment key={group}>
                      <tr className="bg-surface-muted">
                        <td
                          colSpan={clinicRoles.length + 1}
                          className="sticky left-0 bg-surface-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                        >
                          {permissionGroupLabel(group)}
                        </td>
                      </tr>
                      {permissions.map((permission) => (
                        <tr key={permission} className="border-b border-border last:border-0">
                          <td className="sticky left-0 z-10 bg-surface px-4 py-2 text-text-primary">
                            {permissionActionLabel(permission)}
                            <span className="ml-2 font-mono text-xs text-text-secondary">{permission}</span>
                          </td>
                          {clinicRoles.map((role) => {
                            // System roles ARE editable (the backend seeds every clinic role with
                            // isSystem: true — that only protects renaming/deletion, not permissions;
                            // see role.service.ts updateRole). The one true restriction is the clinic
                            // owner role, whose permissions can never be reduced below the full set —
                            // lock only the boxes that are currently checked for that role so the
                            // owner column never drops below all-permissions, matching the 409 the
                            // backend would otherwise return.
                            const isLockedOwnerPermission =
                              role.key === 'clinic_owner' && isChecked(role.id, permission);
                            const disabled =
                              !canManage || updatePermissions.isPending || isLockedOwnerPermission;
                            return (
                              <td key={role.id} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 rounded border-border disabled:opacity-40"
                                  aria-label={`${permission} for ${ROLE_LABELS[role.key]}`}
                                  checked={isChecked(role.id, permission)}
                                  disabled={disabled}
                                  onChange={() => toggle(role.id, permission)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile: one role at a time */}
            <div className="space-y-3 md:hidden">
              <Select value={mobileRoleId} onValueChange={setMobileRoleId}>
                <SelectTrigger aria-label="Choose role to edit">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {clinicRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {ROLE_LABELS[role.key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {mobileRoleId &&
                (() => {
                  const role = rolesById.get(mobileRoleId);
                  if (!role) return null;
                  const isOwnerRole = role.key === 'clinic_owner';
                  return (
                    <>
                      {isOwnerRole && (
                        <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          The clinic owner role always keeps every permission.
                        </p>
                      )}
                      {GROUPS.map(([group, permissions]) => (
                        <Card key={group}>
                          <CardHeader>
                            <CardTitle className="text-sm">{permissionGroupLabel(group)}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {permissions.map((permission) => {
                              const disabled =
                                !canManage ||
                                updatePermissions.isPending ||
                                (isOwnerRole && isChecked(role.id, permission));
                              return (
                                <label
                                  key={permission}
                                  className="flex min-h-[36px] items-center gap-2 text-sm text-text-primary"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-5 w-5 rounded border-border disabled:opacity-40"
                                    checked={isChecked(role.id, permission)}
                                    disabled={disabled}
                                    onChange={() => toggle(role.id, permission)}
                                  />
                                  {permissionActionLabel(permission)}
                                </label>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  );
                })()}
            </div>

            {/* Per-role save bars */}
            {canManage && dirtyRoles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold text-text-primary">Pending changes</h2>
                {dirtyRoles.map((role) => (
                  <Card key={role.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1">
                        <p className="mb-2 text-sm font-medium text-text-primary">{ROLE_LABELS[role.key]}</p>
                        <Field
                          label="Reason for this change"
                          htmlFor={`reason-${role.id}`}
                          required
                          hint="Required — sensitive permission changes are audited"
                        >
                          <Input
                            id={`reason-${role.id}`}
                            value={reasons[role.id] ?? ''}
                            onChange={(e) => setReasons((prev) => ({ ...prev, [role.id]: e.target.value }))}
                            placeholder="e.g. Approved by clinic owner to allow billing refunds"
                          />
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => discard(role.id)}>
                          <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Discard
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!(reasons[role.id] ?? '').trim()}
                          loading={updatePermissions.isPending && updatePermissions.variables?.roleId === role.id}
                          onClick={() => save(role)}
                        >
                          <Save className="h-3.5 w-3.5" aria-hidden="true" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {canManage && dirtyRoles.length === 0 && (
              <p className="mt-6 flex items-center gap-1.5 text-sm text-text-secondary">
                <Check className="h-4 w-4" aria-hidden="true" />
                All roles match their saved permissions.
              </p>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

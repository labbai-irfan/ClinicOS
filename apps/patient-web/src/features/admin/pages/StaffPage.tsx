import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, UserPlus, UserX, UserCheck, Users, X } from 'lucide-react';
import { PERMISSIONS, type RoleKey, type StaffDto } from '@clinicos/types';
import { DEFAULTS, formatMoney } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
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
import { CLINIC_ROLE_KEYS, ROLE_LABELS } from '../labels';
import { useBranchesQuery, useSetStaffActiveMutation, useStaffQuery } from '../api';
import { InviteStaffDialog } from '../components/InviteStaffDialog';

const ROLE_FILTER_ALL = 'all';
const BRANCH_FILTER_ALL = 'all';
const STATUS_FILTER_ALL = 'all';

function feeSummary(staff: StaffDto): string | undefined {
  if (staff.roleKey !== 'doctor') return undefined;
  const parts: string[] = [];
  if (staff.consultationFeePaise != null) parts.push(`Consult ${formatMoney(staff.consultationFeePaise)}`);
  if (staff.followUpFeePaise != null) parts.push(`Follow-up ${formatMoney(staff.followUpFeePaise)}`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export default function StaffPage() {
  const { has } = usePermission();
  const canManage = has(PERMISSIONS.STAFF_MANAGE);

  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>(ROLE_FILTER_ALL);
  const [branchFilter, setBranchFilter] = useState<string>(BRANCH_FILTER_ALL);
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL);
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const limit = DEFAULTS.PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [searchInput, roleFilter, branchFilter, statusFilter]);

  const { data: branches } = useBranchesQuery();
  const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const { data, isLoading, isError, refetch } = useStaffQuery({
    q: searchInput.trim() || undefined,
    roleKey: roleFilter === ROLE_FILTER_ALL ? undefined : (roleFilter as RoleKey),
    branchId: branchFilter === BRANCH_FILTER_ALL ? undefined : branchFilter,
    isActive: statusFilter === STATUS_FILTER_ALL ? undefined : statusFilter === 'active',
    page,
    limit,
  });

  const setActive = useSetStaffActiveMutation();

  function toggleActive(staff: StaffDto) {
    const next = !staff.isActive;
    setActive.mutate(
      { staffId: staff.id, isActive: next },
      {
        onSuccess: () => toast.success(next ? 'Staff reactivated' : 'Staff deactivated', staff.name),
        onError: (err) => toast.error('Could not update staff', apiErrorMessage(err)),
      },
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters =
    Boolean(searchInput.trim()) ||
    roleFilter !== ROLE_FILTER_ALL ||
    branchFilter !== BRANCH_FILTER_ALL ||
    statusFilter !== STATUS_FILTER_ALL;

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage staff accounts, roles, and branch assignments."
        actions={
          canManage ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Invite Staff
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search staff by name or email"
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROLE_FILTER_ALL}>All roles</SelectItem>
            {CLINIC_ROLE_KEYS.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by branch">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BRANCH_FILTER_ALL}>All branches</SelectItem>
            {(branches ?? []).map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={STATUS_FILTER_ALL}>All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              setRoleFilter(ROLE_FILTER_ALL);
              setBranchFilter(BRANCH_FILTER_ALL);
              setStatusFilter(STATUS_FILTER_ALL);
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => void refetch()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle={hasFilters ? 'No staff match your filters' : 'No staff yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different name, role, branch, or status.'
            : canManage
              ? 'Invite your first team member to get started.'
              : undefined
        }
      >
        {(result) => (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Branches</th>
                    <th className="px-4 py-3">Status</th>
                    {canManage && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((staff) => (
                    <tr key={staff.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{staff.name}</p>
                        <p className="text-xs text-text-secondary">{staff.email}</p>
                        {feeSummary(staff) && (
                          <p className="text-xs text-text-secondary">{feeSummary(staff)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{ROLE_LABELS[staff.roleKey]}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {staff.branchIds.map((id) => branchNameById.get(id) ?? id).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          label={staff.isActive ? 'Active' : 'Inactive'}
                          tone={staff.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={setActive.isPending && setActive.variables?.staffId === staff.id}
                            onClick={() => toggleActive(staff)}
                          >
                            {staff.isActive ? (
                              <>
                                <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                Reactivate
                              </>
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile stacked cards */}
            <div className="space-y-3 md:hidden">
              {result.items.map((staff) => (
                <Card key={staff.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{staff.name}</p>
                      <p className="truncate text-xs text-text-secondary">{staff.email}</p>
                    </div>
                    <Users className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-text-secondary">Role</dt>
                      <dd className="text-text-primary">{ROLE_LABELS[staff.roleKey]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Status</dt>
                      <dd>
                        <StatusPill
                          label={staff.isActive ? 'Active' : 'Inactive'}
                          tone={staff.isActive ? 'success' : 'neutral'}
                        />
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-text-secondary">Branches</dt>
                      <dd className="text-text-primary">
                        {staff.branchIds.map((id) => branchNameById.get(id) ?? id).join(', ') || '—'}
                      </dd>
                    </div>
                    {feeSummary(staff) && (
                      <div className="col-span-2">
                        <dt className="text-xs text-text-secondary">Fees</dt>
                        <dd className="text-text-primary">{feeSummary(staff)}</dd>
                      </div>
                    )}
                  </dl>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-3 w-full"
                      loading={setActive.isPending && setActive.variables?.staffId === staff.id}
                      onClick={() => toggleActive(staff)}
                    >
                      {staff.isActive ? (
                        <>
                          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Reactivate
                        </>
                      )}
                    </Button>
                  )}
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {result.total} staff member{result.total === 1 ? '' : 's'} · Page {result.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>

      {canManage && (
        <InviteStaffDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      )}
    </div>
  );
}

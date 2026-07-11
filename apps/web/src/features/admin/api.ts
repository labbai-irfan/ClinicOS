import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { z } from 'zod';
import type {
  ApiSuccess,
  AuditLogDto,
  BranchDto,
  ClinicDto,
  Permission,
  RejoinPolicy,
  RoleKey,
  StaffDto,
  Weekday,
} from '@clinicos/types';
import {
  branchSchema,
  clinicIdentitySchema,
  doctorLeaveSchema,
  doctorScheduleSchema,
  inviteStaffSchema,
  tokenSettingsSchema,
  updateClinicSettingsSchema,
  type DoctorScheduleInput,
  type InviteStaffInput,
  type TokenSettingsInput,
  type UpdateClinicSettingsInput,
} from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';
import { permissionActionLabel } from './labels';

export type { InviteStaffInput, DoctorScheduleInput, TokenSettingsInput, UpdateClinicSettingsInput };

export type ClinicIdentityInput = z.infer<typeof clinicIdentitySchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type DoctorLeaveInput = z.infer<typeof doctorLeaveSchema>;
export {
  clinicIdentitySchema,
  inviteStaffSchema,
  branchSchema,
  doctorScheduleSchema,
  doctorLeaveSchema,
  tokenSettingsSchema,
  updateClinicSettingsSchema,
};

/* ------------------------------------------------------------------------ *
 * Local DTOs — these resources don't have shared shapes in @clinicos/types
 * yet (staff/roles/schedules/settings modules are being built in parallel),
 * so shapes are kept feature-private, same pattern as onboarding/api.ts.
 * ------------------------------------------------------------------------ */

/** GET /clinics/me shape: the shared `ClinicDto` plus prescription branding
 *  fields that live on the same Clinic document but aren't in the shared DTO yet. */
export interface ClinicRecord extends ClinicDto {
  prescriptionHeader?: string;
  prescriptionFooter?: string;
}

/** GET /roles shape — one document per role key, seeded from DEFAULT_ROLE_PERMISSIONS. */
export interface RoleDto {
  id: string;
  key: RoleKey;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
}

/** GET /roles/permissions-catalog shape — canonical permission list with display labels. */
export interface PermissionCatalogEntryDto {
  key: Permission;
  label: string;
}

export interface DoctorScheduleSessionDto {
  start: string;
  end: string;
}

export interface DoctorScheduleDayDto {
  day: Weekday;
  sessions: DoctorScheduleSessionDto[];
}

export interface DoctorScheduleDto {
  id: string;
  doctorId: string;
  branchId: string;
  weekly: DoctorScheduleDayDto[];
  slotMinutes: number;
  bufferMinutes: number;
  maxPerWindow: number;
  walkInCapacityPerDay: number;
}

export interface DoctorLeaveDto {
  id: string;
  doctorId: string;
  branchId?: string;
  from: string;
  to: string;
  reason?: string;
}

/** GET /settings/clinic shape (settings.model.ts `ClinicSettingsDoc`, serialized). */
export interface ClinicSettingsDto {
  id: string;
  appointmentWindowMinutes: number;
  appointmentBufferMinutes: number;
  rejoinPolicy: RejoinPolicy;
  walkInCapacityPerDay: number;
  prescriptionShowDiagnosisDefault: boolean;
}

/** GET /settings/tokens shape (settings.model.ts `TokenSettingsDoc`, serialized). */
export interface TokenSettingsDto {
  id: string;
  branchId: string;
  mode: 'branch' | 'doctor' | 'department';
  prefix: string;
  pad: number;
  dailyReset: boolean;
}

/* ------------------------------------------------------------------------ *
 * Staff
 * ------------------------------------------------------------------------ */

export interface StaffListParams {
  q?: string;
  roleKey?: RoleKey;
  branchId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface StaffListResult {
  items: StaffDto[];
  page: number;
  limit: number;
  total: number;
}

const STAFF_KEY = 'admin-staff' as const;

export function useStaffQuery(params: StaffListParams) {
  return useQuery({
    queryKey: [STAFF_KEY, 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<StaffDto[]>>('/staff', { params });
      return {
        items: data.data,
        page: data.meta.page ?? params.page ?? 1,
        limit: data.meta.limit ?? params.limit ?? data.data.length,
        total: data.meta.total ?? data.data.length,
      } satisfies StaffListResult;
    },
    placeholderData: (previous) => previous,
  });
}

export function useInviteStaffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteStaffInput) => {
      const { data } = await apiClient.post<ApiSuccess<StaffDto>>('/staff', input);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STAFF_KEY, 'list'] }),
  });
}

export function useSetStaffActiveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, isActive }: { staffId: string; isActive: boolean }) => {
      const { data } = await apiClient.patch<ApiSuccess<StaffDto>>(`/staff/${staffId}`, { isActive });
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [STAFF_KEY, 'list'] }),
  });
}

/* ------------------------------------------------------------------------ *
 * Roles & permissions
 * ------------------------------------------------------------------------ */

const ROLES_KEY = ['admin-roles', 'list'] as const;

export function useRolesQuery() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<RoleDto[]>>('/roles');
      return data.data;
    },
  });
}

/** Authoritative permission catalog from the backend. Matrix rows are still built from
 *  `ALL_PERMISSIONS` (@clinicos/types) directly so the UI never depends on this endpoint
 *  being complete — this only supplies nicer display labels when available. */
export function usePermissionsCatalogQuery() {
  return useQuery({
    queryKey: ['admin-roles', 'permissions-catalog'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<Array<PermissionCatalogEntryDto | Permission>>>(
        '/roles/permissions-catalog',
      );
      return data.data.map((entry): PermissionCatalogEntryDto =>
        typeof entry === 'string' ? { key: entry, label: permissionActionLabel(entry) } : entry,
      );
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateRolePermissionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      roleId,
      permissions,
      reason,
    }: {
      roleId: string;
      permissions: Permission[];
      reason: string;
    }) => {
      const { data } = await apiClient.patch<ApiSuccess<RoleDto>>(`/roles/${roleId}`, {
        permissions,
        reason,
      });
      return data.data;
    },
    onSuccess: (role) => {
      queryClient.setQueryData<RoleDto[]>(ROLES_KEY, (previous) =>
        previous?.map((r) => (r.id === role.id ? role : r)),
      );
    },
  });
}

/* ------------------------------------------------------------------------ *
 * Doctor schedules & leaves
 * ------------------------------------------------------------------------ */

export function useDoctorScheduleQuery(doctorId: string | undefined, branchId: string | undefined) {
  return useQuery({
    queryKey: ['admin-schedules', 'weekly', doctorId, branchId],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiSuccess<DoctorScheduleDto | null>>('/schedules', {
          params: { doctorId, branchId },
        });
        return data.data;
      } catch (err) {
        // No schedule configured yet for this doctor/branch is a normal empty state,
        // not a load failure — the editor falls back to defaults.
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: Boolean(doctorId && branchId),
    retry: false,
  });
}

export function useSaveDoctorScheduleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DoctorScheduleInput) => {
      const { data } = await apiClient.post<ApiSuccess<DoctorScheduleDto>>('/schedules', input);
      return data.data;
    },
    onSuccess: (schedule) => {
      queryClient.setQueryData(
        ['admin-schedules', 'weekly', schedule.doctorId, schedule.branchId],
        schedule,
      );
    },
  });
}

export function useDoctorLeavesQuery(doctorId: string | undefined, branchId: string | undefined) {
  return useQuery({
    queryKey: ['admin-schedules', 'leaves', doctorId, branchId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<DoctorLeaveDto[]>>('/schedules/leaves', {
        params: { doctorId, branchId },
      });
      return data.data;
    },
    enabled: Boolean(doctorId),
  });
}

export function useAddDoctorLeaveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DoctorLeaveInput) => {
      const { data } = await apiClient.post<ApiSuccess<DoctorLeaveDto>>('/schedules/leaves', input);
      return data.data;
    },
    onSuccess: (leave) => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules', 'leaves', leave.doctorId] });
    },
  });
}

export function useDeleteDoctorLeaveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leaveId }: { leaveId: string; doctorId: string }) => {
      await apiClient.delete(`/schedules/leaves/${leaveId}`);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules', 'leaves', variables.doctorId] });
    },
  });
}

/* ------------------------------------------------------------------------ *
 * Clinic identity, branches, clinic settings, token settings
 * ------------------------------------------------------------------------ */

const CLINIC_KEY = ['admin-clinic', 'me'] as const;

export function useClinicQuery() {
  return useQuery({
    queryKey: CLINIC_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<ClinicRecord>>('/clinics/me');
      return data.data;
    },
  });
}

export type UpdateClinicInput = Partial<ClinicIdentityInput> & {
  prescriptionHeader?: string;
  prescriptionFooter?: string;
};

export function useUpdateClinicMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateClinicInput) => {
      const { data } = await apiClient.patch<ApiSuccess<ClinicRecord>>('/clinics/me', input);
      return data.data;
    },
    onSuccess: (clinic) => queryClient.setQueryData(CLINIC_KEY, clinic),
  });
}

const BRANCHES_KEY = ['admin-branches', 'list'] as const;

export function useBranchesQuery() {
  return useQuery({
    queryKey: BRANCHES_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<BranchDto[]>>('/branches');
      return data.data;
    },
  });
}

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BranchInput) => {
      const { data } = await apiClient.post<ApiSuccess<BranchDto>>('/branches', input);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
}

export function useUpdateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ branchId, input }: { branchId: string; input: Partial<BranchInput> }) => {
      const { data } = await apiClient.patch<ApiSuccess<BranchDto>>(`/branches/${branchId}`, input);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BRANCHES_KEY }),
  });
}

const CLINIC_SETTINGS_KEY = ['admin-settings', 'clinic'] as const;

export function useClinicSettingsQuery() {
  return useQuery({
    queryKey: CLINIC_SETTINGS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<ClinicSettingsDto>>('/settings/clinic');
      return data.data;
    },
  });
}

export function useUpdateClinicSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateClinicSettingsInput) => {
      const { data } = await apiClient.patch<ApiSuccess<ClinicSettingsDto>>('/settings/clinic', input);
      return data.data;
    },
    onSuccess: (settings) => queryClient.setQueryData(CLINIC_SETTINGS_KEY, settings),
  });
}

export function useTokenSettingsQuery(branchId: string | undefined) {
  return useQuery({
    queryKey: ['admin-settings', 'tokens', branchId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<TokenSettingsDto>>('/settings/tokens', {
        params: { branchId },
      });
      return data.data;
    },
    enabled: Boolean(branchId),
  });
}

export function useUpdateTokenSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TokenSettingsInput) => {
      const { data } = await apiClient.patch<ApiSuccess<TokenSettingsDto>>('/settings/tokens', input);
      return data.data;
    },
    onSuccess: (settings) =>
      queryClient.setQueryData(['admin-settings', 'tokens', settings.branchId], settings),
  });
}

/* ------------------------------------------------------------------------ *
 * Audit logs (read-only)
 * ------------------------------------------------------------------------ */

export interface AuditLogListParams {
  userId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogListResult {
  items: AuditLogDto[];
  page: number;
  limit: number;
  total: number;
}

export function useAuditLogsQuery(params: AuditLogListParams) {
  return useQuery({
    queryKey: ['admin-audit-logs', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<AuditLogDto[]>>('/audit-logs', { params });
      return {
        items: data.data,
        page: data.meta.page ?? params.page ?? 1,
        limit: data.meta.limit ?? params.limit ?? data.data.length,
        total: data.meta.total ?? data.data.length,
      } satisfies AuditLogListResult;
    },
    placeholderData: (previous) => previous,
  });
}

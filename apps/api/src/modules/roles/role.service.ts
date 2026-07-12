import type { Types } from 'mongoose';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_KEYS,
  type Permission,
  type RoleKey,
} from '@clinicos/types';
import type { CreateRoleInput, UpdateRoleInput } from '@clinicos/validation';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { MembershipModel } from '../memberships/membership.model';
import { RoleModel, type RoleDoc } from './role.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
}

/** Matches the frontend `RoleDto` contract (apps/web features/admin/api.ts). */
export interface RoleDto {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Matches the frontend `PermissionCatalogEntryDto` contract ({ key, label } + group metadata). */
export interface PermissionCatalogEntryDto {
  key: Permission;
  label: string;
  group: string;
  groupLabel: string;
}

/** The five roles every clinic is seeded with (spec §9) — platform ops and patients excluded. */
const CLINIC_SYSTEM_ROLE_KEYS: readonly RoleKey[] = ROLE_KEYS.filter(
  (key) => key !== 'super_admin' && key !== 'patient',
);

/** Display labels for permission groups (kept in step with apps/web features/admin/labels.ts). */
const PERMISSION_GROUP_LABELS: Record<string, string> = {
  patient: 'Patients',
  appointment: 'Appointments',
  queue: 'Queue',
  vitals: 'Vitals',
  assessment: 'Nurse assessment',
  consultation: 'Consultation',
  prescription: 'Prescriptions',
  emergency: 'Emergency',
  billing: 'Billing',
  document: 'Documents',
  staff: 'Staff',
  schedule: 'Schedules',
  role: 'Roles',
  reports: 'Reports',
  settings: 'Settings',
  audit: 'Audit',
  onboarding: 'Onboarding',
  notification: 'Notifications',
  dashboard: 'Dashboard',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function titleCaseKey(key: string): string {
  return key
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

export function toRoleDto(doc: RoleDoc): RoleDto {
  return {
    id: doc._id.toString(),
    key: doc.key,
    name: doc.name,
    description: doc.description,
    permissions: doc.permissions,
    isSystem: doc.isSystem,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * The full permission catalog for the roles UI: one entry per canonical permission
 * with a display label and its domain group (first dot-separated segment).
 */
export function permissionsCatalog(): PermissionCatalogEntryDto[] {
  return ALL_PERMISSIONS.map((key) => {
    const group = key.split('.')[0] ?? key;
    const action = key.split('.').slice(1).join(' ').replace(/_/g, ' ');
    return {
      key,
      label: capitalize(action || key),
      group,
      groupLabel: PERMISSION_GROUP_LABELS[group] ?? capitalize(group),
    };
  });
}

/**
 * Ensure the five system roles exist for the clinic, seeded from
 * DEFAULT_ROLE_PERMISSIONS. Normally a no-op (registration seeds them), but makes
 * listing self-healing for clinics created before role seeding existed. Existing
 * documents are never touched, so per-clinic permission overrides are preserved.
 */
async function ensureSystemRoles(tenant: TenantContext): Promise<void> {
  await RoleModel.bulkWrite(
    CLINIC_SYSTEM_ROLE_KEYS.map((key) => ({
      updateOne: {
        filter: { clinicId: tenant.clinicId, key },
        update: {
          $setOnInsert: {
            organizationId: tenant.organizationId,
            clinicId: tenant.clinicId,
            key,
            name: titleCaseKey(key),
            permissions: [...DEFAULT_ROLE_PERMISSIONS[key]],
            isSystem: true,
            deletedAt: null,
          },
        },
        upsert: true,
      },
    })),
  );
}

/** All roles for the caller's clinic: system roles (with effective permissions) + custom roles. */
export async function listRoles(tenant: TenantContext): Promise<RoleDto[]> {
  await ensureSystemRoles(tenant);
  const docs = await RoleModel.find({ clinicId: tenant.clinicId, deletedAt: null })
    .sort({ isSystem: -1, createdAt: 1 })
    .lean();
  return docs.map(toRoleDto);
}

function deriveKeyFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Create a clinic-specific custom role. System role keys are reserved. */
export async function createRole(tenant: TenantContext, input: CreateRoleInput): Promise<RoleDto> {
  const key = input.key ?? deriveKeyFromName(input.name);
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
    throw new ValidationError([
      { field: 'name', message: 'Cannot derive a role key from this name; provide a key.' },
    ]);
  }
  if ((ROLE_KEYS as readonly string[]).includes(key)) {
    throw new ConflictError(`"${key}" is a reserved system role key.`);
  }

  // The unique {clinicId, key} index also covers soft-deleted roles, so check both.
  const existing = await RoleModel.findOne({ clinicId: tenant.clinicId, key }).lean();
  if (existing) throw new ConflictError(`A role with the key "${key}" already exists.`);

  const doc = await RoleModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    key,
    name: input.name,
    description: input.description,
    permissions: input.permissions,
    isSystem: false,
  });
  return toRoleDto(doc.toObject());
}

/**
 * Update a role's permissions (and, for custom roles, its name/description).
 * System role permissions MAY be overridden per clinic — authorize() resolves
 * permissions from this document — but the clinic owner can never be reduced.
 */
export async function updateRole(
  tenant: TenantContext,
  roleId: string,
  input: UpdateRoleInput,
): Promise<{ before: RoleDto; after: RoleDto }> {
  const doc = await RoleModel.findOne({ _id: roleId, clinicId: tenant.clinicId, deletedAt: null });
  if (!doc) throw new NotFoundError('Role');

  if (doc.key === 'clinic_owner') {
    const next = new Set<Permission>(input.permissions);
    const removed = doc.permissions.filter((p) => !next.has(p));
    if (removed.length > 0) {
      throw new ConflictError('Clinic owner permissions cannot be reduced.');
    }
  }
  if (doc.isSystem && input.name !== undefined && input.name !== doc.name) {
    throw new ConflictError('System roles cannot be renamed.');
  }

  const before = toRoleDto(doc.toObject());

  doc.permissions = input.permissions;
  if (!doc.isSystem && input.name !== undefined) doc.name = input.name;
  if (input.description !== undefined) doc.description = input.description;
  await doc.save();

  return { before, after: toRoleDto(doc.toObject()) };
}

/** Soft-delete a custom role. System roles cannot be deleted; assigned roles cannot be removed. */
export async function deleteRole(tenant: TenantContext, roleId: string): Promise<RoleDto> {
  const doc = await RoleModel.findOne({ _id: roleId, clinicId: tenant.clinicId, deletedAt: null });
  if (!doc) throw new NotFoundError('Role');
  if (doc.isSystem) throw new ConflictError('System roles cannot be deleted.');

  // Count ALL memberships (not just active ones): a deactivated staffer keeps
  // their roleId/roleKey, and tenantContext resolves permissions from the role
  // document with no deletedAt filter — reactivating them would otherwise
  // resurrect a role that no longer appears (or is editable) anywhere in the UI.
  const assigned = await MembershipModel.countDocuments({
    clinicId: tenant.clinicId,
    roleId: doc._id,
  });
  if (assigned > 0) {
    throw new ConflictError('This role is still assigned to staff members. Reassign them first.');
  }

  doc.deletedAt = new Date();
  await doc.save();
  return toRoleDto(doc.toObject());
}

// Role module schemas.
import { z } from 'zod';
import { ALL_PERMISSIONS, type Permission } from '@clinicos/types';
import { nonEmptyText, optionalText } from './common';

/** A single permission key, restricted to the canonical catalog in @clinicos/types. */
export const permissionKeySchema = z
  .string()
  .refine(
    (value): value is Permission => (ALL_PERMISSIONS as readonly string[]).includes(value),
    'Unknown permission',
  );

/** De-duplicated list of catalog permissions. */
export const permissionListSchema = z
  .array(permissionKeySchema)
  .transform((values) => Array.from(new Set(values)));

/** Machine key for a clinic-defined custom role, e.g. `billing_clerk`. */
export const customRoleKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9_]{1,39}$/, 'Use lowercase letters, digits and underscores (2-40 chars)');

export const createRoleSchema = z.object({
  name: nonEmptyText(80),
  key: customRoleKeySchema.optional(),
  description: optionalText(300),
  permissions: permissionListSchema,
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

/** Permission changes are sensitive — a short reason is mandatory and audited (spec §37). */
export const updateRoleSchema = z.object({
  name: nonEmptyText(80).optional(),
  description: optionalText(300),
  permissions: permissionListSchema,
  reason: nonEmptyText(500),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const deleteRoleSchema = z.object({
  reason: optionalText(500),
});
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;

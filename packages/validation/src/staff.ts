// Staff module schemas. Shared staff schemas (inviteStaffSchema) live in ./tenancy.
import { z } from 'zod';
import { ROLE_KEYS } from '@clinicos/types';
import { nonEmptyText, objectId, optionalMobileNumber, optionalText } from './common';

/** Roles assignable to clinic staff — platform/patient roles can never be granted here. */
const staffRoleKey = z.enum(ROLE_KEYS).exclude(['super_admin', 'patient']);

/** Query accepted by GET /staff. Pagination (page/limit) is parsed separately. */
export const staffListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  roleKey: staffRoleKey.optional(),
  branchId: objectId.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type StaffListQuery = z.infer<typeof staffListQuery>;

/** Body accepted by PATCH /staff/:id — role, branches, profile fields, fees, activation. */
export const updateStaffSchema = z.object({
  name: nonEmptyText(120).optional(),
  phone: optionalMobileNumber,
  roleKey: staffRoleKey.optional(),
  branchIds: z.array(objectId).min(1, 'Assign at least one branch').optional(),
  specialization: optionalText(120),
  qualification: optionalText(160),
  registrationNumber: optionalText(80),
  consultationFeePaise: z.number().int().min(0).optional(),
  followUpFeePaise: z.number().int().min(0).optional(),
  avgConsultationMinutes: z.number().int().min(1).max(180).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

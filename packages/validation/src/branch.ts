// Branch module schemas. Shared branch schemas (branchSchema, workingHoursSchema)
// live in ./tenancy.
import type { z } from 'zod';
import { branchSchema } from './tenancy';

/** POST /branches body — the shared branch shape (name required; address/hours optional). */
export const createBranchSchema = branchSchema;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

/** PATCH /branches/:id body — any subset of the branch fields (name/address/phone/workingHours). */
export const updateBranchSchema = branchSchema.partial();
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

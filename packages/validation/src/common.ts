import { z } from 'zod';

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

/** Local calendar date, e.g. 2026-07-11 (interpreted in the clinic timezone). */
export const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** 24h time, e.g. 09:30. */
export const timeHHmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24h)');

export const mobileNumber = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid mobile number');

/**
 * Optional mobile number that also accepts an empty string as "not provided".
 * Forms that reset an untouched phone field to `''` (the common React Hook Form
 * default) must not fail validation on a field the user never touched — use this
 * instead of `mobileNumber.optional()` wherever the field is genuinely optional.
 */
export const optionalMobileNumber = mobileNumber.optional().or(z.literal('').transform(() => undefined));

export const nonEmptyText = (max = 200) => z.string().trim().min(1, 'Required').max(max);

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(60).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export const amountPaise = z.number().int().min(0).max(100_000_000_00);

export const reasonRequired = z.object({
  reason: nonEmptyText(500),
});

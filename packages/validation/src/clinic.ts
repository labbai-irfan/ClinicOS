import { z } from 'zod';
import { mobileNumber, optionalText } from './common';
import { clinicIdentitySchema } from './tenancy';

/**
 * Clinic module schemas. Shared clinic schemas (clinicIdentitySchema,
 * workingHoursSchema, updateClinicSettingsSchema) live in ./tenancy — the update
 * schema below is built from `clinicIdentitySchema` rather than redefining it.
 */

/** Total steps in the onboarding wizard — must match apps/web onboarding steps-meta. */
export const ONBOARDING_TOTAL_STEPS = 9;

/**
 * A field the client may leave untouched (omit — `undefined`, no change) or
 * explicitly clear (`''` or `null` — mapped to `null`, "unset this field").
 * Distinguishing "not provided" from "clear it" is what lets PATCH /clinics/me
 * both (a) save a form where an untouched optional field is still `''` and (b)
 * actually remove a previously-set phone/email/logo when the user deletes it.
 */
function clearable<Schema extends z.ZodTypeAny>(schema: Schema) {
  return z
    .union([schema, z.literal(''), z.null()])
    .optional()
    .transform<z.infer<Schema> | null | undefined>((v) => (v === '' ? null : v));
}

/**
 * PATCH /clinics/me body: any subset of identity fields (onboarding step 1 /
 * admin settings) and/or prescription branding (onboarding step 7). Optional
 * contact fields accept `''`/`null` to explicitly clear a previously-set value —
 * see `clinic.service.updateClinic`, which maps `null` to "unset".
 */
export const updateClinicSchema = clinicIdentitySchema.partial().extend({
  phone: clearable(mobileNumber),
  email: clearable(z.string().trim().toLowerCase().email()),
  logoUrl: clearable(z.string().trim().url().max(500)),
  prescriptionHeader: optionalText(1000),
  prescriptionFooter: optionalText(1000),
});
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;

/**
 * PATCH /clinics/me/onboarding-step body: the step the user just completed, plus
 * optional per-step payload the server persists for later resume/review.
 */
export const onboardingStepSchema = z.object({
  step: z.number().int().min(1).max(ONBOARDING_TOTAL_STEPS),
  data: z.record(z.unknown()).optional(),
});
export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;

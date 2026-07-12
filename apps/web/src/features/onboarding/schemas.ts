import { z } from 'zod';
import {
  amountPaise,
  branchSchema,
  clinicIdentitySchema,
  optionalText,
  rejoinPolicySchema,
  workingHoursSchema,
} from '@clinicos/validation';

/**
 * Zod schemas for onboarding-wizard steps. Steps 1, 2/3 and 4/8 reuse the shared
 * `clinicIdentitySchema` / `branchSchema` / `inviteStaffSchema` shapes directly from
 * `@clinicos/validation`. Steps 5, 6 and 7 cover fields that do not yet have shared
 * schemas (clinic settings + prescription branding live on endpoints other agents are
 * still building) — those are defined here, built from the same shared primitives
 * (`amountPaise`, `optionalText`, `rejoinPolicySchema`) rather than inventing new ones.
 */

export { clinicIdentitySchema };
export type ClinicIdentityInput = z.infer<typeof clinicIdentitySchema>;

/** Step 2: address + contact (branch identity minus working hours). */
export const addressContactSchema = branchSchema.omit({ workingHours: true });
export type AddressContactInput = z.infer<typeof addressContactSchema>;

/** Step 3: working days & hours — reuses the shared working-hours schema shape. */
export const workingHoursFormSchema = z.object({ workingHours: workingHoursSchema });
export type WorkingHoursFormInput = z.infer<typeof workingHoursFormSchema>;

/**
 * Step 5: clinic-wide default consultation fee. There is no backend field for a
 * clinic-wide default yet (fees live per-doctor on staff profiles, spec §9) — this
 * schema is kept for the wizard's own client-side form validation only; nothing
 * here is sent to PATCH /settings/clinic (see ConsultationFeeStep).
 */
export const consultationFeeSchema = z.object({
  defaultConsultationFeePaise: amountPaise,
});
export type ConsultationFeeInput = z.infer<typeof consultationFeeSchema>;

/** Step 6: appointment window/buffer + queue rejoin policy. Field names must match
 *  `updateClinicSettingsSchema` (PATCH /settings/clinic) exactly — unknown keys are
 *  silently stripped by the backend's non-strict zod object. */
export const queueRulesSchema = z.object({
  appointmentWindowMinutes: z.number().int().min(5).max(120),
  appointmentBufferMinutes: z.number().int().min(0).max(60),
  rejoinPolicy: rejoinPolicySchema,
});
export type QueueRulesInput = z.infer<typeof queueRulesSchema>;

/** Step 7: prescription branding (header/footer live directly on the Clinic record). */
export const prescriptionBrandingSchema = z.object({
  prescriptionHeader: optionalText(1000),
  prescriptionFooter: optionalText(1000),
});
export type PrescriptionBrandingInput = z.infer<typeof prescriptionBrandingSchema>;

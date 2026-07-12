import type { Types, UpdateQuery } from 'mongoose';
import type { ClinicDto } from '@clinicos/types';
import {
  ONBOARDING_TOTAL_STEPS,
  type OnboardingStepInput,
  type UpdateClinicInput,
} from '@clinicos/validation';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { BranchModel } from '../branches/branch.model';
import { MembershipModel } from '../memberships/membership.model';
import { ClinicModel, type ClinicDoc } from './clinic.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
}

/**
 * GET /clinics/me shape: the shared `ClinicDto` plus fields that live on the same
 * Clinic document but aren't in the shared DTO yet (prescription branding,
 * activation timestamp) — mirrored by `ClinicRecord` in the web features.
 */
export interface ClinicRecordDto extends ClinicDto {
  prescriptionHeader?: string;
  prescriptionFooter?: string;
  onboardingData?: Record<string, unknown>;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function toClinicDto(doc: ClinicDoc): ClinicRecordDto {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    name: doc.name,
    slug: doc.slug,
    phone: doc.phone,
    email: doc.email,
    logoUrl: doc.logoUrl,
    timezone: doc.timezone,
    onboardingStep: doc.onboardingStep,
    onboardingComplete: doc.onboardingComplete,
    onboardingData: doc.onboardingData,
    prescriptionHeader: doc.prescriptionHeader,
    prescriptionFooter: doc.prescriptionFooter,
    isActive: doc.isActive,
    activatedAt: doc.activatedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** The caller's own clinic — "me" is always resolved from the server-side tenant context. */
export async function getClinic(tenant: TenantContext): Promise<ClinicRecordDto> {
  const doc = await ClinicModel.findOne({ _id: tenant.clinicId, deletedAt: null }).lean();
  if (!doc) throw new NotFoundError('Clinic');
  return toClinicDto(doc);
}

/** Update identity/branding fields on the caller's own clinic (partial-patch semantics). */
export async function updateClinic(
  tenant: TenantContext,
  input: UpdateClinicInput,
): Promise<{ before: ClinicRecordDto; after: ClinicRecordDto }> {
  const doc = await ClinicModel.findOne({ _id: tenant.clinicId, deletedAt: null });
  if (!doc) throw new NotFoundError('Clinic');

  const before = toClinicDto(doc.toObject());

  if (input.name !== undefined) doc.name = input.name;
  // `null` is an explicit "clear this field" signal from updateClinicSchema —
  // distinct from `undefined` ("field omitted, leave as-is").
  if (input.phone !== undefined) doc.phone = input.phone ?? undefined;
  if (input.email !== undefined) doc.email = input.email ?? undefined;
  if (input.timezone !== undefined) doc.timezone = input.timezone;
  if (input.logoUrl !== undefined) doc.logoUrl = input.logoUrl ?? undefined;
  if (input.prescriptionHeader !== undefined) doc.prescriptionHeader = input.prescriptionHeader;
  if (input.prescriptionFooter !== undefined) doc.prescriptionFooter = input.prescriptionFooter;

  await doc.save();

  return { before, after: toClinicDto(doc.toObject()) };
}

/**
 * Record completion of onboarding step N (spec §8): progress moves to step N+1
 * (capped at the review step) and is monotonic — re-saving an earlier step never
 * moves a clinic's resume point backward. Optional per-step payloads are kept
 * under `onboardingData.step<N>`.
 */
export async function advanceOnboardingStep(
  tenant: TenantContext,
  input: OnboardingStepInput,
): Promise<{ before: ClinicRecordDto; after: ClinicRecordDto }> {
  const before = await getClinic(tenant);

  const nextStep = Math.min(input.step + 1, ONBOARDING_TOTAL_STEPS);
  const update: UpdateQuery<ClinicDoc> = { $max: { onboardingStep: nextStep } };
  if (input.data !== undefined) {
    update.$set = { [`onboardingData.step${input.step}`]: input.data };
  }

  const doc = await ClinicModel.findOneAndUpdate(
    { _id: tenant.clinicId, deletedAt: null },
    update,
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError('Clinic');

  return { before, after: toClinicDto(doc) };
}

/**
 * Activate the clinic at the end of onboarding (spec §8 step 9). Requires the
 * wizard to have reached the review step — i.e. every setup step was recorded —
 * then marks onboarding complete and the clinic active. Idempotent: activating
 * an already-active clinic is a no-op that returns the current record.
 */
export async function activateClinic(
  tenant: TenantContext,
): Promise<{ before: ClinicRecordDto; after: ClinicRecordDto; alreadyActive: boolean }> {
  const doc = await ClinicModel.findOne({ _id: tenant.clinicId, deletedAt: null });
  if (!doc) throw new NotFoundError('Clinic');

  const before = toClinicDto(doc.toObject());
  if (doc.onboardingComplete && doc.isActive) {
    return { before, after: before, alreadyActive: true };
  }

  if (doc.onboardingStep < ONBOARDING_TOTAL_STEPS) {
    throw new ConflictError(
      'Complete all onboarding steps before activating the clinic.',
    );
  }

  // `onboardingStep` is a client-reported counter (POST .../onboarding-step accepts
  // any step 1-9 the caller claims to have completed) — it is evidence of progress,
  // not proof of it. Verify the state activation actually promises: a bookable
  // branch and someone who can run the clinic.
  const [activeBranchCount, activeOwnerCount] = await Promise.all([
    BranchModel.countDocuments({ clinicId: tenant.clinicId, isActive: true, deletedAt: null }),
    MembershipModel.countDocuments({
      clinicId: tenant.clinicId,
      roleKey: 'clinic_owner',
      isActive: true,
    }),
  ]);
  if (activeBranchCount === 0) {
    throw new ConflictError('Add at least one branch before activating the clinic.');
  }
  if (activeOwnerCount === 0) {
    throw new ConflictError('The clinic must have at least one active owner before activating.');
  }

  doc.onboardingComplete = true;
  doc.isActive = true;
  doc.activatedAt = new Date();
  await doc.save();

  return { before, after: toClinicDto(doc.toObject()), alreadyActive: false };
}

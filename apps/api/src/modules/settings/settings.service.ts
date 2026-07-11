import type { Types } from 'mongoose';
import type { RejoinPolicy } from '@clinicos/types';
import type { TokenSettingsInput, UpdateClinicSettingsInput } from '@clinicos/validation';
import { NotFoundError } from '../../shared/errors';
import { BranchModel } from '../branches/branch.model';
import {
  ClinicSettingsModel,
  TokenSettingsModel,
  type ClinicSettingsDoc,
  type TokenMode,
  type TokenSettingsDoc,
} from './settings.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
}

export interface ClinicSettingsDto {
  id: string;
  clinicId: string;
  appointmentWindowMinutes: number;
  appointmentBufferMinutes: number;
  rejoinPolicy: RejoinPolicy;
  walkInCapacityPerDay: number;
  prescriptionShowDiagnosisDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenSettingsDto {
  id: string;
  branchId: string;
  mode: TokenMode;
  prefix: string;
  pad: number;
  dailyReset: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toClinicSettingsDto(doc: ClinicSettingsDoc): ClinicSettingsDto {
  return {
    id: doc._id.toString(),
    clinicId: doc.clinicId.toString(),
    appointmentWindowMinutes: doc.appointmentWindowMinutes,
    appointmentBufferMinutes: doc.appointmentBufferMinutes,
    rejoinPolicy: doc.rejoinPolicy,
    walkInCapacityPerDay: doc.walkInCapacityPerDay,
    prescriptionShowDiagnosisDefault: doc.prescriptionShowDiagnosisDefault,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toTokenSettingsDto(doc: TokenSettingsDoc): TokenSettingsDto {
  return {
    id: doc._id.toString(),
    branchId: doc.branchId ? doc.branchId.toString() : '',
    mode: doc.mode,
    prefix: doc.prefix,
    pad: doc.pad,
    dailyReset: doc.dailyReset,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Get-or-create the single clinic settings document, seeded with spec defaults
 * (DEFAULTS.* from @clinicos/config) on first access — upsert-on-read, no separate
 * onboarding write path required.
 */
export async function getOrCreateClinicSettings(tenant: TenantContext): Promise<ClinicSettingsDto> {
  const doc = await ClinicSettingsModel.findOneAndUpdate(
    { clinicId: tenant.clinicId },
    {
      $setOnInsert: {
        organizationId: tenant.organizationId,
        clinicId: tenant.clinicId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return toClinicSettingsDto(doc);
}

export async function updateClinicSettings(
  tenant: TenantContext,
  input: UpdateClinicSettingsInput,
): Promise<{ before: ClinicSettingsDto; after: ClinicSettingsDto }> {
  const before = await getOrCreateClinicSettings(tenant);

  const doc = await ClinicSettingsModel.findOneAndUpdate(
    { clinicId: tenant.clinicId },
    { $set: input },
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError('Clinic settings');

  return { before, after: toClinicSettingsDto(doc) };
}

/** Verify the branch belongs to the caller's own clinic before touching its settings. */
async function assertBranchInClinic(tenant: TenantContext, branchId: string): Promise<Types.ObjectId> {
  const branch = await BranchModel.findOne({
    _id: branchId,
    clinicId: tenant.clinicId,
    isActive: true,
  }).lean();
  if (!branch) throw new NotFoundError('Branch');
  return branch._id;
}

/**
 * Get-or-create the per-branch token settings document, seeded with spec defaults
 * (DEFAULTS.TOKEN_PREFIX / DEFAULTS.TOKEN_PAD) on first access.
 */
export async function getOrCreateTokenSettings(
  tenant: TenantContext,
  branchId: string,
): Promise<TokenSettingsDto> {
  const resolvedBranchId = await assertBranchInClinic(tenant, branchId);

  const doc = await TokenSettingsModel.findOneAndUpdate(
    { branchId: resolvedBranchId },
    {
      $setOnInsert: {
        organizationId: tenant.organizationId,
        clinicId: tenant.clinicId,
        branchId: resolvedBranchId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  return toTokenSettingsDto(doc);
}

export async function updateTokenSettings(
  tenant: TenantContext,
  input: TokenSettingsInput,
): Promise<{ before: TokenSettingsDto; after: TokenSettingsDto }> {
  const before = await getOrCreateTokenSettings(tenant, input.branchId);

  const { branchId, ...rest } = input;
  const doc = await TokenSettingsModel.findOneAndUpdate(
    { branchId, clinicId: tenant.clinicId },
    { $set: rest },
    { new: true },
  ).lean();
  if (!doc) throw new NotFoundError('Token settings');

  return { before, after: toTokenSettingsDto(doc) };
}

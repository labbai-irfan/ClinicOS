import type { Types } from 'mongoose';
import type { BranchDto } from '@clinicos/types';
import type { CreateBranchInput, UpdateBranchInput } from '@clinicos/validation';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { MembershipModel } from '../memberships/membership.model';
import { BranchModel, type BranchDoc } from './branch.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
}

export function toBranchDto(doc: BranchDoc): BranchDto {
  return {
    id: doc._id.toString(),
    clinicId: doc.clinicId.toString(),
    name: doc.name,
    addressLine1: doc.addressLine1,
    addressLine2: doc.addressLine2,
    city: doc.city,
    state: doc.state,
    postalCode: doc.postalCode,
    phone: doc.phone,
    workingHours: doc.workingHours.map((w) => ({
      day: w.day,
      open: w.open,
      close: w.close,
      closed: w.closed,
    })),
    isActive: doc.isActive,
  };
}

/** All non-deleted branches of the caller's clinic, oldest first (Main Branch first). */
export async function list(tenant: TenantContext): Promise<BranchDto[]> {
  const docs = await BranchModel.find({ clinicId: tenant.clinicId, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean();
  return docs.map(toBranchDto);
}

export async function create(tenant: TenantContext, input: CreateBranchInput): Promise<BranchDto> {
  const doc = await BranchModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    name: input.name,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    phone: input.phone,
    workingHours: input.workingHours ?? [],
  });
  return toBranchDto(doc.toObject());
}

export async function update(
  tenant: TenantContext,
  branchId: string,
  input: UpdateBranchInput,
): Promise<{ before: BranchDto; after: BranchDto }> {
  const doc = await BranchModel.findOne({
    _id: branchId,
    clinicId: tenant.clinicId,
    deletedAt: null,
  });
  if (!doc) throw new NotFoundError('Branch');

  const before = toBranchDto(doc.toObject());

  if (input.name !== undefined) doc.name = input.name;
  if (input.addressLine1 !== undefined) doc.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) doc.addressLine2 = input.addressLine2;
  if (input.city !== undefined) doc.city = input.city;
  if (input.state !== undefined) doc.state = input.state;
  if (input.postalCode !== undefined) doc.postalCode = input.postalCode;
  if (input.phone !== undefined) doc.phone = input.phone;
  if (input.workingHours !== undefined) doc.workingHours = input.workingHours;

  await doc.save();

  return { before, after: toBranchDto(doc.toObject()) };
}

/**
 * Soft-deactivate a branch: marks it inactive and soft-deleted (`deletedAt`) — never a
 * hard delete, so queue/appointment/billing history referencing the branch stays intact.
 * A clinic must always keep at least one active branch (tenant context requires one).
 */
export async function deactivate(
  tenant: TenantContext,
  branchId: string,
): Promise<{ before: BranchDto; after: BranchDto }> {
  const doc = await BranchModel.findOne({
    _id: branchId,
    clinicId: tenant.clinicId,
    deletedAt: null,
  });
  if (!doc) throw new NotFoundError('Branch');
  if (!doc.isActive) throw new ConflictError('Branch is already deactivated.');

  const before = toBranchDto(doc.toObject());

  // Check-then-act against a sibling collection (other Branch documents) is racy
  // across two concurrent deactivations (no multi-document transactions here) —
  // guard with an optimistic claim: atomically flip this branch inactive first,
  // then verify at least one other active branch still exists, rolling back if not.
  const claimed = await BranchModel.findOneAndUpdate(
    { _id: doc._id, isActive: true, deletedAt: null },
    { $set: { isActive: false, deletedAt: new Date() } },
    { new: true },
  );
  if (!claimed) throw new ConflictError('Branch is already deactivated.');

  const otherActive = await BranchModel.countDocuments({
    clinicId: tenant.clinicId,
    _id: { $ne: doc._id },
    isActive: true,
    deletedAt: null,
  });
  if (otherActive === 0) {
    await BranchModel.updateOne({ _id: doc._id }, { $set: { isActive: true, deletedAt: null } });
    throw new ConflictError('Cannot deactivate the last active branch of the clinic.');
  }

  // A deactivated branch must stop being anyone's resolvable tenant context —
  // strip it from every membership that listed it (tenantContext otherwise keeps
  // routing staff into a branch that no longer exists as far as booking/queue/
  // billing should be concerned). Staff left with zero branches simply lose
  // access until reassigned (tenantContext already rejects that case).
  await MembershipModel.updateMany(
    { clinicId: tenant.clinicId, branchIds: doc._id },
    { $pull: { branchIds: doc._id } },
  );

  return { before, after: toBranchDto(claimed.toObject()) };
}

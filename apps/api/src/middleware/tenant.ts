import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import type { Permission } from '@clinicos/types';
import { MembershipModel } from '../modules/memberships/membership.model';
import { RoleModel } from '../modules/roles/role.model';
import { ClinicModel } from '../modules/clinics/clinic.model';
import { ForbiddenError, UnauthenticatedError } from '../shared/errors';
import { asyncHandler } from '../shared/http';

/**
 * Resolves tenant context strictly from the authenticated user's active membership.
 * Client-supplied organization/clinic ids in the payload are NEVER used for scoping.
 * The active branch may be selected with the `x-branch-id` header, but only from
 * branches the membership actually grants.
 */
export const tenantContext = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new UnauthenticatedError();

    const membership = await MembershipModel.findOne({
      userId: req.auth.userId,
      isActive: true,
    }).lean();
    if (!membership) throw new ForbiddenError('No active clinic membership.');

    const [role, clinic] = await Promise.all([
      RoleModel.findById(membership.roleId).lean(),
      ClinicModel.findById(membership.clinicId).lean(),
    ]);
    if (!role || !clinic || !clinic.isActive) {
      throw new ForbiddenError('Clinic access is not available.');
    }

    let branchId = membership.branchIds[0];
    const headerBranch = req.headers['x-branch-id'];
    if (typeof headerBranch === 'string' && Types.ObjectId.isValid(headerBranch)) {
      const requested = new Types.ObjectId(headerBranch);
      const allowed = membership.branchIds.some((b) => b.equals(requested));
      if (!allowed) throw new ForbiddenError('You do not have access to this branch.');
      branchId = requested;
    }
    if (!branchId) throw new ForbiddenError('No branch assigned to your account.');

    req.tenant = {
      organizationId: membership.organizationId,
      clinicId: membership.clinicId,
      branchId,
      branchIds: membership.branchIds,
      membershipId: membership._id,
      roleKey: membership.roleKey,
      permissions: new Set(role.permissions as Permission[]),
      timezone: clinic.timezone,
    };
    next();
  },
);

/** Convenience: the standard tenant filter for branch-scoped queries. */
export function tenantFilter(req: Request): {
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  deletedAt: null;
} {
  if (!req.tenant) throw new UnauthenticatedError();
  return { clinicId: req.tenant.clinicId, branchId: req.tenant.branchId, deletedAt: null };
}

/** Tenant filter for clinic-scoped (branch-independent) queries. */
export function clinicFilter(req: Request): { clinicId: Types.ObjectId; deletedAt: null } {
  if (!req.tenant) throw new UnauthenticatedError();
  return { clinicId: req.tenant.clinicId, deletedAt: null };
}

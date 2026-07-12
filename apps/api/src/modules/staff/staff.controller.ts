import type { Request, Response } from 'express';
import type { StaffListQuery } from '@clinicos/validation';
import { created, ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { parsePagination } from '../../shared/pagination';
import { UnauthenticatedError } from '../../shared/errors';
import * as staffService from './staff.service';

function requireTenant(req: Request): staffService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    actorRoleKey: req.tenant.roleKey,
    actorPermissions: req.tenant.permissions,
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req);
  // Parsed (typed, transformed) by validate(staffListQuery, 'query') upstream.
  const { q, roleKey, branchId, isActive } = req.query as unknown as StaffListQuery;
  const { items, total } = await staffService.listStaff(
    requireTenant(req),
    { q, roleKey, branchId, isActive },
    pagination,
  );
  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

export async function invite(req: Request, res: Response): Promise<void> {
  const staff = await staffService.inviteStaff(requireTenant(req), req.body);
  // Never persist the one-time generated password into the audit trail — it's
  // returned to the caller in the HTTP response only, not written anywhere else.
  const { temporaryPassword: _temporaryPassword, ...auditSafeStaff } = staff;
  await audit(req, {
    action: 'staff.invite',
    resource: 'staff',
    resourceId: staff.id,
    after: auditSafeStaff,
  });
  created(res, staff);
}

export async function update(req: Request, res: Response): Promise<void> {
  // `:id` is guaranteed present by the route match; validated as an objectId upstream.
  const { before, after } = await staffService.updateStaff(requireTenant(req), req.params.id!, req.body);
  await audit(req, {
    action: 'staff.update',
    resource: 'staff',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { UnauthenticatedError } from '../../shared/errors';
import * as service from './dashboard.service';
import type { TenantScope } from './dashboard.service';

function requireTenant(req: Request): TenantScope {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
    timezone: req.tenant.timezone,
  };
}

/** GET /dashboard/summary — today's operational snapshot for the caller's branch. Read-only,
 * so no audit entry is written (mirrors the other read-only board/list endpoints). */
export async function summary(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const dto = await service.getSummary(tenant);
  ok(res, dto);
}

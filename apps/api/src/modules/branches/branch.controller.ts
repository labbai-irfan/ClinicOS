import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as branchService from './branch.service';

function requireTenant(req: Request): branchService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId };
}

export async function list(req: Request, res: Response): Promise<void> {
  const branches = await branchService.list(requireTenant(req));
  ok(res, branches);
}

export async function create(req: Request, res: Response): Promise<void> {
  const branch = await branchService.create(requireTenant(req), req.body);
  await audit(req, { action: 'branch.create', resource: 'branch', resourceId: branch.id, after: branch });
  created(res, branch);
}

export async function update(req: Request, res: Response): Promise<void> {
  // `:id` is guaranteed present by the route match; validated as an objectId upstream.
  const { before, after } = await branchService.update(requireTenant(req), req.params.id!, req.body);
  await audit(req, {
    action: 'branch.update',
    resource: 'branch',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const { before, after } = await branchService.deactivate(requireTenant(req), req.params.id!);
  await audit(req, {
    action: 'branch.deactivate',
    resource: 'branch',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

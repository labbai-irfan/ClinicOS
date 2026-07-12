import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as roleService from './role.service';

function requireTenant(req: Request): roleService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId };
}

export async function list(req: Request, res: Response): Promise<void> {
  const roles = await roleService.listRoles(requireTenant(req));
  ok(res, roles);
}

export async function permissionsCatalog(_req: Request, res: Response): Promise<void> {
  ok(res, roleService.permissionsCatalog());
}

export async function create(req: Request, res: Response): Promise<void> {
  const role = await roleService.createRole(requireTenant(req), req.body);
  await audit(req, { action: 'role.create', resource: 'role', resourceId: role.id, after: role });
  created(res, role);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason: string };
  // `:id` is guaranteed present by the route match; validated as an objectId upstream.
  const { before, after } = await roleService.updateRole(requireTenant(req), req.params.id!, req.body);
  await audit(req, {
    action: 'role.update_permissions',
    resource: 'role',
    resourceId: after.id,
    before,
    after,
    reason,
  });
  ok(res, after);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason?: string };
  const role = await roleService.deleteRole(requireTenant(req), req.params.id!);
  await audit(req, {
    action: 'role.delete',
    resource: 'role',
    resourceId: role.id,
    before: role,
    reason,
  });
  ok(res, { id: role.id, deleted: true });
}

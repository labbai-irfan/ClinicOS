import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as settingsService from './settings.service';

function requireTenant(req: Request): settingsService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId };
}

export async function getClinicSettings(req: Request, res: Response): Promise<void> {
  const settings = await settingsService.getOrCreateClinicSettings(requireTenant(req));
  ok(res, settings);
}

export async function updateClinicSettings(req: Request, res: Response): Promise<void> {
  const { before, after } = await settingsService.updateClinicSettings(requireTenant(req), req.body);
  await audit(req, {
    action: 'settings.clinic_update',
    resource: 'clinic_settings',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

export async function getTokenSettings(req: Request, res: Response): Promise<void> {
  const { branchId } = req.query as { branchId: string };
  const settings = await settingsService.getOrCreateTokenSettings(requireTenant(req), branchId);
  ok(res, settings);
}

export async function updateTokenSettings(req: Request, res: Response): Promise<void> {
  const { before, after } = await settingsService.updateTokenSettings(requireTenant(req), req.body);
  await audit(req, {
    action: 'settings.token_update',
    resource: 'token_settings',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as clinicService from './clinic.service';

function requireTenant(req: Request): clinicService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId };
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const clinic = await clinicService.getClinic(requireTenant(req));
  ok(res, clinic);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const { before, after } = await clinicService.updateClinic(requireTenant(req), req.body);
  await audit(req, {
    action: 'clinic.update',
    resource: 'clinic',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

export async function advanceOnboardingStep(req: Request, res: Response): Promise<void> {
  const { before, after } = await clinicService.advanceOnboardingStep(requireTenant(req), req.body);
  await audit(req, {
    action: 'clinic.onboarding_step',
    resource: 'clinic',
    resourceId: after.id,
    before: { onboardingStep: before.onboardingStep },
    after: { onboardingStep: after.onboardingStep },
  });
  ok(res, after);
}

export async function activate(req: Request, res: Response): Promise<void> {
  const { before, after, alreadyActive } = await clinicService.activateClinic(requireTenant(req));
  if (!alreadyActive) {
    await audit(req, {
      action: 'clinic.activate',
      resource: 'clinic',
      resourceId: after.id,
      before: { onboardingComplete: before.onboardingComplete, isActive: before.isActive },
      after: { onboardingComplete: after.onboardingComplete, isActive: after.isActive },
    });
  }
  ok(res, after);
}

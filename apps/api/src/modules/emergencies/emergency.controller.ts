import type { Request, Response } from 'express';
import type { EmergencyStatus } from '@clinicos/types';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as emergencyService from './emergency.service';
import type { ServiceContext } from './emergency.service';

function requireContext(req: Request): ServiceContext {
  if (!req.tenant || !req.auth) throw new UnauthenticatedError();
  return { tenant: req.tenant, actor: req.auth };
}

/** `validate(idParams, 'params')` always runs before these controllers, so `:id` is present. */
function paramId(req: Request): string {
  return req.params.id as string;
}

export async function create(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const dto = await emergencyService.createEmergency(ctx, req.body);
  await audit(req, {
    action: 'emergency.create',
    resource: 'emergency_case',
    resourceId: dto.id,
    after: dto,
  });
  created(res, dto);
}

export async function board(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const status = req.query.status as EmergencyStatus | undefined;
  const items = await emergencyService.listBoard(ctx, status);
  ok(res, items);
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const dto = await emergencyService.getEmergency(ctx, paramId(req));
  ok(res, dto);
}

export async function events(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const items = await emergencyService.listEvents(ctx, paramId(req));
  ok(res, items);
}

export async function triage(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const id = paramId(req);
  const before = await emergencyService.getEmergency(ctx, id);
  const dto = await emergencyService.triageEmergency(ctx, id, req.body);
  await audit(req, {
    action: 'emergency.triage',
    resource: 'emergency_case',
    resourceId: dto.id,
    before,
    after: dto,
    reason: req.body.notes,
  });
  ok(res, dto);
}

export async function transition(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const id = paramId(req);
  const before = await emergencyService.getEmergency(ctx, id);
  const dto = await emergencyService.transitionEmergency(ctx, id, req.body);
  await audit(req, {
    action: 'emergency.transition',
    resource: 'emergency_case',
    resourceId: dto.id,
    before,
    after: dto,
    reason: req.body.notes,
  });
  ok(res, dto);
}

export async function assign(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const id = paramId(req);
  const before = await emergencyService.getEmergency(ctx, id);
  const dto = await emergencyService.assignEmergency(ctx, id, req.body);
  await audit(req, {
    action: 'emergency.assign',
    resource: 'emergency_case',
    resourceId: dto.id,
    before,
    after: dto,
  });
  ok(res, dto);
}

export async function referral(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const id = paramId(req);
  const before = await emergencyService.getEmergency(ctx, id);
  const dto = await emergencyService.referEmergency(ctx, id, req.body);
  await audit(req, {
    action: 'emergency.referral',
    resource: 'emergency_case',
    resourceId: dto.id,
    before,
    after: dto,
    reason: req.body.reason,
  });
  ok(res, dto);
}

export async function observation(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const id = paramId(req);
  const dto = await emergencyService.addObservationNote(ctx, id, req.body);
  await audit(req, {
    action: 'emergency.observation_note',
    resource: 'emergency_case',
    resourceId: dto.id,
    reason: req.body.note,
  });
  ok(res, dto);
}

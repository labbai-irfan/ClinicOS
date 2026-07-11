import type { Request, Response } from 'express';
import type { VitalsInput } from '@clinicos/validation';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError, ForbiddenError } from '../../shared/errors';
import * as vitalService from './vital.service';

interface VitalsListQuery {
  patientId?: string;
  queueEntryId?: string;
  emergencyCaseId?: string;
}

export async function createVital(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new UnauthenticatedError();
  if (!req.tenant) throw new ForbiddenError('No clinic context.');

  const dto = await vitalService.recordVital(
    req.tenant,
    { userId: req.auth.userId, name: req.auth.name },
    req.body as VitalsInput,
  );

  await audit(req, { action: 'vitals.create', resource: 'vital', resourceId: dto.id });
  created(res, dto);
}

export async function listVitals(req: Request, res: Response): Promise<void> {
  if (!req.tenant) throw new ForbiddenError('No clinic context.');
  const { patientId, queueEntryId, emergencyCaseId } = req.query as VitalsListQuery;

  const items = await vitalService.listVitals(req.tenant.clinicId, {
    patientId,
    queueEntryId,
    emergencyCaseId,
  });
  ok(res, items);
}

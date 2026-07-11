import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import { audit } from '../../shared/audit';
import { parsePagination } from '../../shared/pagination';
import { UnauthenticatedError } from '../../shared/errors';
import * as patientService from './patient.service';

function requireTenant(req: Request): patientService.TenantContext {
  if (!req.tenant) throw new UnauthenticatedError();
  return { organizationId: req.tenant.organizationId, clinicId: req.tenant.clinicId };
}

export async function checkDuplicates(req: Request, res: Response): Promise<void> {
  const { mobile, fullName, dateOfBirth } = req.query as {
    mobile?: string;
    fullName?: string;
    dateOfBirth?: string;
  };
  const candidates = await patientService.checkDuplicates(requireTenant(req), {
    mobile,
    fullName,
    dateOfBirth,
  });
  ok(res, candidates);
}

export async function search(req: Request, res: Response): Promise<void> {
  const pagination = parsePagination(req);
  const { q, mobile, code, dateOfBirth } = req.query as {
    q?: string;
    mobile?: string;
    code?: string;
    dateOfBirth?: string;
  };
  const { items, total } = await patientService.search(
    requireTenant(req),
    { q, mobile, code, dateOfBirth },
    pagination,
  );
  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { patient, duplicates } = await patientService.quickRegister(requireTenant(req), req.body);
  await audit(req, { action: 'patient.create', resource: 'patient', resourceId: patient.id, after: patient });
  created(res, patient, duplicates.length > 0 ? { duplicateWarnings: duplicates } : {});
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  // `:id` is guaranteed present by the route match; validated as an objectId upstream.
  const patient = await patientService.getProfile(requireTenant(req), req.params.id!);
  ok(res, patient);
}

export async function update(req: Request, res: Response): Promise<void> {
  const { before, after } = await patientService.update(requireTenant(req), req.params.id!, req.body);
  await audit(req, {
    action: 'patient.update',
    resource: 'patient',
    resourceId: after.id,
    before,
    after,
  });
  ok(res, after);
}

export async function merge(req: Request, res: Response): Promise<void> {
  const { primaryId, duplicateId, reason } = req.body as {
    primaryId: string;
    duplicateId: string;
    reason: string;
  };
  const { primary, duplicate } = await patientService.merge(requireTenant(req), {
    primaryId,
    duplicateId,
    reason,
  });
  await audit(req, {
    action: 'patient.merge',
    resource: 'patient',
    resourceId: duplicate.id,
    before: { primaryId: primary.id, duplicateId: duplicate.id, mergedIntoPatientId: null },
    after: { primaryId: primary.id, duplicateId: duplicate.id, mergedIntoPatientId: primary.id },
    reason,
  });
  ok(res, { primary, duplicate });
}

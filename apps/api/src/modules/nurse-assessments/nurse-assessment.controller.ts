import type { Request, Response } from 'express';
import type { NurseAssessmentDto } from '@clinicos/types';
import type { NurseAssessmentInput } from '@clinicos/validation';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import * as service from './nurse-assessment.service';
import type { NurseAssessmentDoc } from './nurse-assessment.model';

function requireTenant(req: Request): service.TenantScope {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
  };
}

function toDto(doc: NurseAssessmentDoc): NurseAssessmentDto {
  return {
    id: doc._id.toString(),
    patientId: doc.patientId.toString(),
    queueEntryId: doc.queueEntryId.toString(),
    chiefComplaint: doc.chiefComplaint,
    symptoms: doc.symptoms,
    durationText: doc.durationText,
    painLevel: doc.painLevel,
    relevantHistory: doc.relevantHistory,
    allergies: doc.allergies,
    conditions: doc.conditions,
    currentMedicines: doc.currentMedicines,
    previousTreatment: doc.previousTreatment,
    nurseNotes: doc.nurseNotes,
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
  };
}

/**
 * POST /nurse-assessments — start or autosave the draft for a queue entry (upsert on
 * queueEntryId). Send `complete: true` on the final save to mark it completed.
 */
export async function save(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const input = req.body as NurseAssessmentInput;
  const { doc, wasCreated } = await service.saveAssessment(tenant, input);
  await audit(req, {
    action: wasCreated ? 'assessment.start' : input.complete ? 'assessment.complete' : 'assessment.autosave',
    resource: 'nurse_assessment',
    resourceId: doc._id.toString(),
  });
  if (wasCreated) {
    created(res, toDto(doc));
  } else {
    ok(res, toDto(doc));
  }
}

export async function getByQueueEntry(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const doc = await service.getByQueueEntryOrThrow(tenant, req.params.queueEntryId as string);
  ok(res, toDto(doc));
}

export async function getByPatient(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const docs = await service.listByPatient(tenant, req.params.patientId as string);
  ok(res, docs.map(toDto));
}

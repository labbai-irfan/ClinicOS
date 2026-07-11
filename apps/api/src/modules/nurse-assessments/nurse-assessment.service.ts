import { Types } from 'mongoose';
import type { NurseAssessmentInput } from '@clinicos/validation';
import { NurseAssessmentModel, type NurseAssessmentDoc } from './nurse-assessment.model';
import { NotFoundError } from '../../shared/errors';

/** Tenant scoping context, resolved by `tenantContext` middleware — never from client input. */
export interface TenantScope {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
}

export interface SaveResult {
  doc: NurseAssessmentDoc;
  /** True when this call started a new draft rather than updating an existing one. */
  wasCreated: boolean;
}

/**
 * Starts or updates the draft assessment for a queue entry (upsert on queueEntryId +
 * clinicId). Called repeatedly for autosave: status stays 'draft' on every call until
 * the caller sends `complete: true`, at which point status flips to 'completed' and
 * completedAt is stamped. Never transitions the linked queue entry itself.
 */
export async function saveAssessment(
  tenant: TenantScope,
  input: NurseAssessmentInput,
): Promise<SaveResult> {
  const now = new Date();
  const set: Record<string, unknown> = {
    patientId: new Types.ObjectId(input.patientId),
    chiefComplaint: input.chiefComplaint,
    symptoms: input.symptoms,
    durationText: input.durationText,
    painLevel: input.painLevel,
    relevantHistory: input.relevantHistory,
    allergies: input.allergies,
    conditions: input.conditions,
    currentMedicines: input.currentMedicines,
    previousTreatment: input.previousTreatment,
    nurseNotes: input.nurseNotes,
    status: input.complete ? 'completed' : 'draft',
  };
  if (input.complete) set.completedAt = now;

  const result = await NurseAssessmentModel.findOneAndUpdate(
    {
      clinicId: tenant.clinicId,
      queueEntryId: new Types.ObjectId(input.queueEntryId),
      deletedAt: null,
    },
    {
      $set: set,
      $setOnInsert: {
        organizationId: tenant.organizationId,
        clinicId: tenant.clinicId,
        branchId: tenant.branchId,
        queueEntryId: new Types.ObjectId(input.queueEntryId),
        startedAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, includeResultMetadata: true },
  );
  const doc = result.value;
  if (!doc) throw new Error('nurse assessment upsert failed to return a document');
  return { doc, wasCreated: !result.lastErrorObject?.updatedExisting };
}

export async function getByQueueEntry(
  tenant: TenantScope,
  queueEntryId: string,
): Promise<NurseAssessmentDoc | null> {
  return NurseAssessmentModel.findOne({
    clinicId: tenant.clinicId,
    queueEntryId: new Types.ObjectId(queueEntryId),
    deletedAt: null,
  });
}

export async function getByQueueEntryOrThrow(
  tenant: TenantScope,
  queueEntryId: string,
): Promise<NurseAssessmentDoc> {
  const doc = await getByQueueEntry(tenant, queueEntryId);
  if (!doc) throw new NotFoundError('Nurse assessment');
  return doc;
}

export async function listByPatient(
  tenant: TenantScope,
  patientId: string,
): Promise<NurseAssessmentDoc[]> {
  return NurseAssessmentModel.find({
    clinicId: tenant.clinicId,
    patientId: new Types.ObjectId(patientId),
    deletedAt: null,
  }).sort({ startedAt: -1 });
}

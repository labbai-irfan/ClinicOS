import type { Request } from 'express';
import { Types } from 'mongoose';
import type { ConsultationDto } from '@clinicos/types';
import type { ConsultationInput } from '@clinicos/validation';
import { clinicFilter, tenantFilter } from '../../middleware';
import { InvalidTransitionError, NotFoundError, RecordFinalizedError } from '../../shared/errors';
import { audit } from '../../shared/audit';
import { zonedTimeToUtc } from '../../shared/dates';
import { UserModel } from '../users/user.model';
import { ConsultationModel, type ConsultationDoc } from './consultation.model';
import { ConsultationAmendmentModel } from './consultation-amendment.model';

export interface AmendConsultationInput {
  reason: string;
  changes: Record<string, unknown>;
}

export interface ConsultationAmendmentSummary {
  id: string;
  consultationId: string;
  reason: string;
  changes: Record<string, unknown>;
  amendedByUserId: string;
  amendedByName: string;
  createdAt: string;
}

function localDateToUtc(timezone: string, localDate: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return zonedTimeToUtc(timezone, y, m, d);
}

function asObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function findValidId(id: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

async function doctorNamesFor(doctorIds: Types.ObjectId[]): Promise<Map<string, string>> {
  const unique = [...new Set(doctorIds.map((id) => id.toString()))];
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique } }, { name: 1 }).lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

function toDto(doc: ConsultationDoc, doctorName?: string): ConsultationDto {
  return {
    id: doc._id.toString(),
    patientId: doc.patientId.toString(),
    queueEntryId: doc.queueEntryId?.toString(),
    doctorId: doc.doctorId.toString(),
    doctorName,
    symptoms: doc.symptoms,
    examinationFindings: doc.examinationFindings,
    clinicalNotes: doc.clinicalNotes,
    diagnosis: doc.diagnosis,
    treatmentPlan: doc.treatmentPlan,
    advice: doc.advice,
    testsOrdered: doc.testsOrdered,
    followUpAt: doc.followUpAt?.toISOString(),
    status: doc.status,
    startedAt: doc.startedAt.toISOString(),
    completedAt: doc.completedAt?.toISOString(),
    version: doc.version,
  };
}

/**
 * Starts a doctor's consultation, or (when `queueEntryId` matches an existing draft)
 * resumes/updates it — the same upsert-by-queueEntryId pattern used by
 * nurse-assessments. Once the record is `completed`, calling this again is a direct
 * edit attempt and is rejected: finalized consultations may only change via
 * `amendConsultation`.
 */
export async function startOrUpdateDraft(req: Request): Promise<ConsultationDto> {
  const body = req.body as ConsultationInput;
  const doctorId = req.auth!.userId;
  const followUpAt = body.followUpDate
    ? localDateToUtc(req.tenant!.timezone, body.followUpDate)
    : undefined;

  const existing = body.queueEntryId
    ? await ConsultationModel.findOne({
        ...tenantFilter(req),
        queueEntryId: asObjectId(body.queueEntryId),
      })
    : null;

  if (existing) {
    if (existing.status === 'completed') {
      throw new RecordFinalizedError('Consultation');
    }
    existing.doctorId = doctorId;
    existing.patientId = asObjectId(body.patientId);
    existing.symptoms = body.symptoms;
    existing.examinationFindings = body.examinationFindings;
    existing.clinicalNotes = body.clinicalNotes;
    existing.diagnosis = body.diagnosis;
    existing.treatmentPlan = body.treatmentPlan;
    existing.advice = body.advice;
    existing.testsOrdered = body.testsOrdered;
    existing.followUpAt = followUpAt;
    // `existing.status` cannot be 'completed' here — that case threw above.
    if (body.complete) {
      existing.status = 'completed';
      existing.completedAt = new Date();
    }
    await existing.save();
    const names = await doctorNamesFor([existing.doctorId]);
    return toDto(existing, names.get(existing.doctorId.toString()));
  }

  const created = await ConsultationModel.create({
    ...tenantFilter(req),
    organizationId: req.tenant!.organizationId,
    patientId: asObjectId(body.patientId),
    queueEntryId: body.queueEntryId ? asObjectId(body.queueEntryId) : undefined,
    doctorId,
    symptoms: body.symptoms,
    examinationFindings: body.examinationFindings,
    clinicalNotes: body.clinicalNotes,
    diagnosis: body.diagnosis,
    treatmentPlan: body.treatmentPlan,
    advice: body.advice,
    testsOrdered: body.testsOrdered,
    followUpAt,
    status: body.complete ? 'completed' : 'draft',
    startedAt: new Date(),
    completedAt: body.complete ? new Date() : undefined,
    version: 0,
  });

  const names = await doctorNamesFor([created.doctorId]);
  return toDto(created, names.get(created.doctorId.toString()));
}

/**
 * Amends a finalized consultation: applies `changes` as a partial patch of the
 * clinical fields, flips status to `amended`, bumps `version`, records an
 * append-only ConsultationAmendmentModel entry, and writes an audit log entry.
 */
export async function amendConsultation(
  req: Request,
  id: string,
  input: AmendConsultationInput,
): Promise<ConsultationDto> {
  const objectId = findValidId(id);
  if (!objectId) throw new NotFoundError('Consultation');

  const consultation = await ConsultationModel.findOne({ _id: objectId, ...clinicFilter(req) });
  if (!consultation) throw new NotFoundError('Consultation');
  if (consultation.status !== 'completed') {
    throw new InvalidTransitionError(consultation.status, 'amended');
  }

  const before = toDto(consultation);
  const { changes, reason } = input;

  if (typeof changes.symptoms === 'string') consultation.symptoms = changes.symptoms;
  if (typeof changes.examinationFindings === 'string') {
    consultation.examinationFindings = changes.examinationFindings;
  }
  if (typeof changes.clinicalNotes === 'string') consultation.clinicalNotes = changes.clinicalNotes;
  if (Array.isArray(changes.diagnosis)) {
    consultation.diagnosis = changes.diagnosis.filter((x): x is string => typeof x === 'string');
  }
  if (typeof changes.treatmentPlan === 'string') consultation.treatmentPlan = changes.treatmentPlan;
  if (typeof changes.advice === 'string') consultation.advice = changes.advice;
  if (Array.isArray(changes.testsOrdered)) {
    consultation.testsOrdered = changes.testsOrdered.filter((x): x is string => typeof x === 'string');
  }
  if (typeof changes.followUpDate === 'string') {
    consultation.followUpAt = localDateToUtc(req.tenant!.timezone, changes.followUpDate);
  } else if (typeof changes.followUpAt === 'string') {
    consultation.followUpAt = new Date(changes.followUpAt);
  }

  consultation.status = 'amended';
  consultation.version += 1;
  await consultation.save();

  await ConsultationAmendmentModel.create({
    organizationId: req.tenant!.organizationId,
    clinicId: req.tenant!.clinicId,
    branchId: req.tenant!.branchId,
    consultationId: consultation._id,
    reason,
    changes,
    amendedByUserId: req.auth!.userId,
    amendedByName: req.auth!.name,
  });

  const after = toDto(consultation);
  await audit(req, {
    action: 'consultation.amend',
    resource: 'consultation',
    resourceId: consultation._id.toString(),
    before,
    after,
    reason,
  });

  const names = await doctorNamesFor([consultation.doctorId]);
  return toDto(consultation, names.get(consultation.doctorId.toString()));
}

export async function getConsultationById(req: Request, id: string): Promise<ConsultationDto> {
  const objectId = findValidId(id);
  if (!objectId) throw new NotFoundError('Consultation');
  const consultation = await ConsultationModel.findOne({ _id: objectId, ...clinicFilter(req) });
  if (!consultation) throw new NotFoundError('Consultation');
  const names = await doctorNamesFor([consultation.doctorId]);
  return toDto(consultation, names.get(consultation.doctorId.toString()));
}

/** Consultation history for a patient's clinical timeline, newest first. */
export async function listByPatientId(req: Request, patientId: string): Promise<ConsultationDto[]> {
  const objectId = findValidId(patientId);
  if (!objectId) return [];
  const consultations = await ConsultationModel.find({
    patientId: objectId,
    ...clinicFilter(req),
  }).sort({ startedAt: -1 });
  const names = await doctorNamesFor(consultations.map((c) => c.doctorId));
  return consultations.map((c) => toDto(c, names.get(c.doctorId.toString())));
}

export async function listAmendments(
  req: Request,
  consultationId: string,
): Promise<ConsultationAmendmentSummary[]> {
  const objectId = findValidId(consultationId);
  if (!objectId) throw new NotFoundError('Consultation');
  const consultation = await ConsultationModel.findOne({ _id: objectId, ...clinicFilter(req) });
  if (!consultation) throw new NotFoundError('Consultation');

  const amendments = await ConsultationAmendmentModel.find({
    consultationId: consultation._id,
    ...clinicFilter(req),
  }).sort({ createdAt: -1 });

  return amendments.map((a) => ({
    id: a._id.toString(),
    consultationId: a.consultationId.toString(),
    reason: a.reason,
    changes: a.changes,
    amendedByUserId: a.amendedByUserId.toString(),
    amendedByName: a.amendedByName,
    createdAt: a.createdAt.toISOString(),
  }));
}

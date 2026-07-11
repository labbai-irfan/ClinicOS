import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import type { PrescriptionDto, PrescriptionItemDto } from '@clinicos/types';
import type { PrescriptionInput } from '@clinicos/validation';
import { NotFoundError, RecordFinalizedError } from '../../shared/errors';
import { localDateTimeToUtc } from '../../shared/dates';
import { ConsultationModel } from '../consultations/consultation.model';
import { PrescriptionModel, type PrescriptionDoc, type PrescriptionItem } from './prescription.model';

/**
 * Tenant scoping context, resolved by `authenticate`/`tenantContext` middleware —
 * NEVER built from client input (clinicId/branchId are always server-resolved).
 */
export interface PrescriptionContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  timezone: string;
}

export type SavePrescriptionAction = 'draft_created' | 'draft_updated' | 'finalized' | 'revised';

export interface SavePrescriptionResult {
  doc: PrescriptionDoc;
  action: SavePrescriptionAction;
}

export interface PrescriptionHistory {
  current: PrescriptionDoc;
  history: PrescriptionDoc[];
}

const VERIFICATION_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Random 8-character alphanumeric verification code stamped on a prescription the
 * moment it is finalized, so a pharmacist/patient can verify authenticity against the
 * clinic's record.
 */
function generateVerificationCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (const byte of bytes) {
    code += VERIFICATION_CODE_ALPHABET[byte % VERIFICATION_CODE_ALPHABET.length];
  }
  return code;
}

function itemToDto(item: PrescriptionItem): PrescriptionItemDto {
  return {
    medicineName: item.medicineName,
    genericName: item.genericName,
    form: item.form,
    strength: item.strength,
    dose: item.dose,
    route: item.route,
    frequency: item.frequency,
    durationDays: item.durationDays,
    timing: item.timing,
    foodRelation: item.foodRelation,
    instruction: item.instruction,
  };
}

export function toPrescriptionDto(doc: PrescriptionDoc): PrescriptionDto {
  return {
    id: doc._id.toString(),
    consultationId: doc.consultationId.toString(),
    patientId: doc.patientId.toString(),
    doctorId: doc.doctorId.toString(),
    items: doc.items.map(itemToDto),
    advice: doc.advice,
    testsRecommended: doc.testsRecommended,
    followUpAt: doc.followUpAt?.toISOString(),
    includeDiagnosis: doc.includeDiagnosis,
    status: doc.status,
    versionNumber: doc.versionNumber,
    verificationCode: doc.verificationCode,
    finalizedAt: doc.finalizedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

async function loadConsultation(ctx: PrescriptionContext, consultationId: string) {
  const consultation = await ConsultationModel.findOne({
    _id: consultationId,
    clinicId: ctx.clinicId,
    deletedAt: null,
  }).lean();
  if (!consultation) throw new NotFoundError('Consultation');
  return consultation;
}

/**
 * Creates/updates a doctor's prescription for a consultation (spec §23).
 *
 * - `finalize: false` — autosave-style upsert of the DRAFT (findOneAndUpdate on
 *   consultationId + status "draft", upsert true). Safe to call any number of times.
 * - `finalize: true`, no prior finalized prescription for this consultation — the
 *   draft (if any) is promoted in place to `finalized`, versionNumber 1, with a fresh
 *   verificationCode and finalizedAt.
 * - `finalize: true`, a finalized prescription already exists (the doctor is revising
 *   it) — the OLD finalized document is marked `superseded` and a brand NEW document
 *   is created with versionNumber = old + 1 and its own verificationCode. A finalized
 *   prescription is never overwritten in place (ADR-12 immutability).
 */
export async function savePrescription(
  ctx: PrescriptionContext,
  input: PrescriptionInput,
): Promise<SavePrescriptionResult> {
  const consultation = await loadConsultation(ctx, input.consultationId);

  const followUpAt = input.followUpDate
    ? localDateTimeToUtc(ctx.timezone, input.followUpDate, '00:00')
    : undefined;

  const fields = {
    consultationId: consultation._id,
    patientId: consultation.patientId,
    doctorId: consultation.doctorId,
    organizationId: ctx.organizationId,
    clinicId: ctx.clinicId,
    branchId: ctx.branchId,
    items: input.items as PrescriptionItem[],
    advice: input.advice,
    testsRecommended: input.testsRecommended,
    followUpAt,
    includeDiagnosis: input.includeDiagnosis,
  };

  if (!input.finalize) {
    const result = await PrescriptionModel.findOneAndUpdate(
      { consultationId: consultation._id, clinicId: ctx.clinicId, status: 'draft', deletedAt: null },
      { $set: fields, $setOnInsert: { status: 'draft', versionNumber: 1 } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
        includeResultMetadata: true,
      },
    );
    const doc = result.value;
    if (!doc) throw new Error('prescription draft upsert failed to return a document');
    return { doc, action: result.lastErrorObject?.updatedExisting ? 'draft_updated' : 'draft_created' };
  }

  const existingFinalized = await PrescriptionModel.findOne({
    consultationId: consultation._id,
    clinicId: ctx.clinicId,
    status: 'finalized',
    deletedAt: null,
  });

  const verificationCode = generateVerificationCode();
  const finalizedAt = new Date();

  if (!existingFinalized) {
    // First finalization for this consultation: promote the existing draft (if any) in
    // place, or create one directly if the doctor never saved an intermediate draft.
    const doc = await PrescriptionModel.findOneAndUpdate(
      { consultationId: consultation._id, clinicId: ctx.clinicId, status: 'draft', deletedAt: null },
      {
        $set: {
          ...fields,
          status: 'finalized',
          versionNumber: 1,
          verificationCode,
          finalizedAt,
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).orFail(() => new Error('prescription finalize upsert failed to return a document'));
    return { doc, action: 'finalized' };
  }

  const superseded = await PrescriptionModel.findOneAndUpdate(
    { _id: existingFinalized._id, status: 'finalized' },
    { $set: { status: 'superseded' } },
    { new: true },
  );
  if (!superseded) {
    // Raced with another finalize call for the same consultation between our read and
    // write — the record we intended to supersede is no longer the current finalized
    // version, so it is no longer safe to mutate directly.
    throw new RecordFinalizedError('Prescription');
  }

  // Any stray in-progress draft for this consultation is now moot — its content has
  // been folded into the new finalized version below.
  await PrescriptionModel.deleteOne({
    consultationId: consultation._id,
    clinicId: ctx.clinicId,
    status: 'draft',
    deletedAt: null,
  });

  const doc = await PrescriptionModel.create({
    ...fields,
    status: 'finalized',
    versionNumber: existingFinalized.versionNumber + 1,
    verificationCode,
    finalizedAt,
  });
  return { doc, action: 'revised' };
}

export async function getPrescriptionById(ctx: PrescriptionContext, id: string): Promise<PrescriptionDoc> {
  return PrescriptionModel.findOne({ _id: id, clinicId: ctx.clinicId, deletedAt: null }).orFail(
    () => new NotFoundError('Prescription'),
  );
}

/** Current record for a consultation (latest finalized, else the draft) plus full version history. */
export async function getByConsultation(
  ctx: PrescriptionContext,
  consultationId: string,
): Promise<PrescriptionHistory> {
  const filter = { consultationId, clinicId: ctx.clinicId, deletedAt: null };
  const [finalized, draft, history] = await Promise.all([
    PrescriptionModel.findOne({ ...filter, status: 'finalized' }).sort({ versionNumber: -1 }),
    PrescriptionModel.findOne({ ...filter, status: 'draft' }),
    PrescriptionModel.find(filter).sort({ versionNumber: -1, createdAt: -1 }),
  ]);
  const current = finalized ?? draft;
  if (!current) throw new NotFoundError('Prescription');
  return { current, history };
}

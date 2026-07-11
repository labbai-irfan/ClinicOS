import { Types } from 'mongoose';
import type { VitalRecordDto } from '@clinicos/types';
import type { VitalsInput } from '@clinicos/validation';
import { VitalRecordModel, type VitalRecordDoc } from './vital.model';

export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
}

export interface ActorContext {
  userId: Types.ObjectId;
  name: string;
}

export interface VitalListFilter {
  patientId?: string;
  queueEntryId?: string;
  emergencyCaseId?: string;
}

/**
 * BMI = weight(kg) / height(m)^2, rounded to 1 decimal. Undefined unless both
 * height and weight are present — never trust a client-supplied bmi value.
 */
export function computeBmi(heightCm?: number, weightKg?: number): number | undefined {
  if (heightCm === undefined || weightKg === undefined) return undefined;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.round(bmi * 10) / 10;
}

export function toVitalDto(doc: VitalRecordDoc): VitalRecordDto {
  return {
    id: doc._id.toString(),
    patientId: doc.patientId.toString(),
    queueEntryId: doc.queueEntryId?.toString(),
    emergencyCaseId: doc.emergencyCaseId?.toString(),
    temperatureC: doc.temperatureC,
    systolic: doc.systolic,
    diastolic: doc.diastolic,
    pulseBpm: doc.pulseBpm,
    spo2Percent: doc.spo2Percent,
    respiratoryRate: doc.respiratoryRate,
    heightCm: doc.heightCm,
    weightKg: doc.weightKg,
    bmi: doc.bmi,
    bloodGlucoseMgDl: doc.bloodGlucoseMgDl,
    recordedAt: doc.recordedAt.toISOString(),
    recordedByName: doc.recordedByName,
  };
}

/** Records one vitals capture. Computes BMI server-side; ignores any client-sent bmi. */
export async function recordVital(
  tenant: TenantContext,
  actor: ActorContext,
  input: VitalsInput,
): Promise<VitalRecordDto> {
  const doc = await VitalRecordModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    patientId: new Types.ObjectId(input.patientId),
    queueEntryId: input.queueEntryId ? new Types.ObjectId(input.queueEntryId) : undefined,
    emergencyCaseId: input.emergencyCaseId ? new Types.ObjectId(input.emergencyCaseId) : undefined,
    temperatureC: input.temperatureC,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulseBpm: input.pulseBpm,
    spo2Percent: input.spo2Percent,
    respiratoryRate: input.respiratoryRate,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    bmi: computeBmi(input.heightCm, input.weightKg),
    bloodGlucoseMgDl: input.bloodGlucoseMgDl,
    recordedByUserId: actor.userId,
    recordedByName: actor.name,
    recordedAt: new Date(),
  });
  return toVitalDto(doc);
}

/**
 * Lists vitals for trend charts (patient profile) / the doctor consultation view.
 * Scoped to the clinic (not a single branch) so a patient's history is visible
 * regardless of which branch recorded each reading; optional filters narrow further.
 */
export async function listVitals(
  clinicId: Types.ObjectId,
  filter: VitalListFilter,
): Promise<VitalRecordDto[]> {
  const query: Record<string, unknown> = { clinicId, deletedAt: null };
  if (filter.patientId) query.patientId = new Types.ObjectId(filter.patientId);
  if (filter.queueEntryId) query.queueEntryId = new Types.ObjectId(filter.queueEntryId);
  if (filter.emergencyCaseId) query.emergencyCaseId = new Types.ObjectId(filter.emergencyCaseId);

  // Secondary sort by _id (monotonically increasing) breaks ties deterministically
  // when two records are captured within the same millisecond.
  const docs = await VitalRecordModel.find(query).sort({ recordedAt: -1, _id: -1 }).lean();
  return docs.map(toVitalDto);
}

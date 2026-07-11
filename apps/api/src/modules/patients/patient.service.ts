import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';
import type { PatientAlertDto, PatientDto } from '@clinicos/types';
import type { QuickRegisterPatientInput, UpdatePatientInput } from '@clinicos/validation';
import { computeAge, formatToken } from '@clinicos/config';
import { nextSequence } from '../../shared/sequence';
import type { Pagination } from '../../shared/pagination';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { PatientModel, type PatientDoc } from './patient.model';

/** Minimal tenant context a service function needs — never trust ids from client input. */
export interface TenantContext {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
}

export interface PatientDuplicateCandidateDto {
  id: string;
  code: string;
  fullName: string;
  mobile?: string;
  dateOfBirth?: string;
}

/** Profile response — adds a server-computed age alongside the canonical PatientDto shape. */
export interface PatientProfileDto extends PatientDto {
  age?: number;
}

interface MergePatientsInput {
  primaryId: string;
  duplicateId: string;
  reason: string;
}

interface PatientSearchFilters {
  q?: string;
  mobile?: string;
  code?: string;
  dateOfBirth?: string;
}

interface DuplicateCheckParams {
  mobile?: string;
  fullName?: string;
  dateOfBirth?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnlyString(value?: Date): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function computeAlerts(doc: Pick<PatientDoc, 'allergies' | 'conditions'>): PatientAlertDto[] {
  const alerts: PatientAlertDto[] = [];
  for (const allergy of doc.allergies) {
    alerts.push({ kind: 'allergy', label: allergy, severity: 'warning' });
  }
  for (const condition of doc.conditions) {
    alerts.push({ kind: 'clinical', label: condition, severity: 'info' });
  }
  return alerts;
}

export function toPatientDto(doc: PatientDoc): PatientDto {
  return {
    id: doc._id.toString(),
    code: doc.code,
    fullName: doc.fullName,
    gender: doc.gender,
    dateOfBirth: toDateOnlyString(doc.dateOfBirth),
    approximateAge: doc.approximateAge,
    mobile: doc.mobile,
    alternateContact: doc.alternateContact,
    email: doc.email,
    addressLine: doc.addressLine,
    city: doc.city,
    preferredLanguage: doc.preferredLanguage,
    emergencyContacts: doc.emergencyContacts.map((c) => ({
      name: c.name,
      relation: c.relation,
      phone: c.phone,
    })),
    allergies: doc.allergies,
    conditions: doc.conditions,
    currentMedicines: doc.currentMedicines,
    notes: doc.notes,
    alerts: computeAlerts(doc),
    isTemporary: doc.isTemporary,
    lastVisitAt: doc.lastVisitAt?.toISOString(),
    nextAppointmentAt: doc.nextAppointmentAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

/**
 * Duplicate detection (spec §12): mobile exact match OR (fullName case-insensitive
 * similarity AND dateOfBirth match). Never auto-merges — surfaces candidates only.
 * Merged-away records are excluded.
 */
export async function checkDuplicates(
  tenant: TenantContext,
  params: DuplicateCheckParams,
): Promise<PatientDuplicateCandidateDto[]> {
  const or: FilterQuery<PatientDoc>[] = [];
  if (params.mobile) or.push({ mobile: params.mobile });
  if (params.fullName && params.dateOfBirth) {
    or.push({
      fullName: new RegExp(`^${escapeRegex(params.fullName.trim())}$`, 'i'),
      dateOfBirth: toLocalDate(params.dateOfBirth),
    });
  }
  if (or.length === 0) return [];

  const docs = await PatientModel.find({
    clinicId: tenant.clinicId,
    deletedAt: null,
    mergedIntoPatientId: null,
    $or: or,
  })
    .select({ code: 1, fullName: 1, mobile: 1, dateOfBirth: 1 })
    .limit(10)
    .lean();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    code: doc.code,
    fullName: doc.fullName,
    mobile: doc.mobile,
    dateOfBirth: toDateOnlyString(doc.dateOfBirth),
  }));
}

export async function search(
  tenant: TenantContext,
  filters: PatientSearchFilters,
  pagination: Pagination,
): Promise<{ items: PatientDto[]; total: number }> {
  const filter: FilterQuery<PatientDoc> = {
    clinicId: tenant.clinicId,
    deletedAt: null,
    mergedIntoPatientId: null,
  };
  if (filters.mobile) filter.mobile = filters.mobile;
  if (filters.code) filter.code = new RegExp(`^${escapeRegex(filters.code)}`, 'i');
  if (filters.dateOfBirth) filter.dateOfBirth = toLocalDate(filters.dateOfBirth);
  if (filters.q) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    filter.$or = [{ fullName: pattern }, { code: pattern }];
  }

  const [docs, total] = await Promise.all([
    PatientModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    PatientModel.countDocuments(filter),
  ]);

  return { items: docs.map(toPatientDto), total };
}

export async function quickRegister(
  tenant: TenantContext,
  input: QuickRegisterPatientInput,
): Promise<{ patient: PatientDto; duplicates: PatientDuplicateCandidateDto[] }> {
  // Run duplicate detection first so the caller can be warned — creation is never
  // blocked by it (spec §12: controlled, non-blocking duplicate warning).
  const duplicates = await checkDuplicates(tenant, {
    mobile: input.mobile,
    fullName: input.fullName,
    dateOfBirth: input.dateOfBirth,
  });

  const seq = await nextSequence(`patient:${tenant.clinicId.toString()}`);
  const code = formatToken('P', seq, 6);

  const doc = await PatientModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    code,
    fullName: input.fullName,
    gender: input.gender,
    dateOfBirth: input.dateOfBirth ? toLocalDate(input.dateOfBirth) : undefined,
    approximateAge: input.approximateAge,
    mobile: input.mobile,
    isTemporary: input.isTemporary,
    emergencyContacts: [],
    allergies: [],
    conditions: [],
    currentMedicines: [],
  });

  return { patient: toPatientDto(doc.toObject()), duplicates };
}

export async function getProfile(tenant: TenantContext, patientId: string): Promise<PatientProfileDto> {
  const doc = await PatientModel.findOne({
    _id: patientId,
    clinicId: tenant.clinicId,
    deletedAt: null,
  }).lean();
  if (!doc) throw new NotFoundError('Patient');

  return { ...toPatientDto(doc), age: computeAge(doc.dateOfBirth, doc.approximateAge) };
}

export async function update(
  tenant: TenantContext,
  patientId: string,
  input: UpdatePatientInput,
): Promise<{ before: PatientDto; after: PatientDto }> {
  const doc = await PatientModel.findOne({ _id: patientId, clinicId: tenant.clinicId, deletedAt: null });
  if (!doc) throw new NotFoundError('Patient');
  if (doc.mergedIntoPatientId) {
    throw new ConflictError('This patient record has been merged; update the primary record instead.');
  }

  const before = toPatientDto(doc.toObject());

  if (input.fullName !== undefined) doc.fullName = input.fullName;
  if (input.gender !== undefined) doc.gender = input.gender;
  if (input.dateOfBirth !== undefined) doc.dateOfBirth = toLocalDate(input.dateOfBirth);
  if (input.approximateAge !== undefined) doc.approximateAge = input.approximateAge;
  if (input.mobile !== undefined) doc.mobile = input.mobile;
  if (input.alternateContact !== undefined) doc.alternateContact = input.alternateContact;
  if (input.email !== undefined) doc.email = input.email;
  if (input.addressLine !== undefined) doc.addressLine = input.addressLine;
  if (input.city !== undefined) doc.city = input.city;
  if (input.preferredLanguage !== undefined) doc.preferredLanguage = input.preferredLanguage;
  if (input.emergencyContacts !== undefined) doc.emergencyContacts = input.emergencyContacts;
  if (input.allergies !== undefined) doc.allergies = input.allergies;
  if (input.conditions !== undefined) doc.conditions = input.conditions;
  if (input.currentMedicines !== undefined) doc.currentMedicines = input.currentMedicines;
  if (input.notes !== undefined) doc.notes = input.notes;

  await doc.save();

  return { before, after: toPatientDto(doc.toObject()) };
}

/**
 * Controlled merge workflow (spec §12): soft merge only — the duplicate record is
 * never hard-deleted, only flagged via `mergedIntoPatientId` so history/audit stays
 * intact. Excluded from search/duplicate-check results from then on.
 */
export async function merge(
  tenant: TenantContext,
  input: MergePatientsInput,
): Promise<{ primary: PatientDto; duplicate: PatientDto }> {
  if (input.primaryId === input.duplicateId) {
    throw new ConflictError('Cannot merge a patient into itself.');
  }

  const [primary, duplicate] = await Promise.all([
    PatientModel.findOne({ _id: input.primaryId, clinicId: tenant.clinicId, deletedAt: null }),
    PatientModel.findOne({ _id: input.duplicateId, clinicId: tenant.clinicId, deletedAt: null }),
  ]);
  if (!primary) throw new NotFoundError('Primary patient');
  if (!duplicate) throw new NotFoundError('Duplicate patient');
  if (primary.mergedIntoPatientId) {
    throw new ConflictError('Primary patient record has itself already been merged.');
  }
  if (duplicate.mergedIntoPatientId) {
    throw new ConflictError('Duplicate patient record has already been merged.');
  }

  duplicate.mergedIntoPatientId = primary._id;
  await duplicate.save();

  return { primary: toPatientDto(primary.toObject()), duplicate: toPatientDto(duplicate.toObject()) };
}

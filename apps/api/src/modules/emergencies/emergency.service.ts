import { Types, type HydratedDocument } from 'mongoose';
import type { Request } from 'express';
import type { z } from 'zod';
import {
  SOCKET_EVENTS,
  canTransitionEmergency,
  type EmergencyCaseDto,
  type EmergencyStatus,
} from '@clinicos/types';
import type { CreateEmergencyInput } from '@clinicos/validation';
import {
  emergencyAssignSchema,
  emergencyObservationSchema,
  emergencyReferralSchema,
  emergencyTransitionSchema,
  emergencyTriageSchema,
} from '@clinicos/validation';
import { InvalidTransitionError, NotFoundError } from '../../shared/errors';
import { nextSequence } from '../../shared/sequence';
import { todayInTimezone } from '../../shared/dates';
import { emitToBranch, emitToUser } from '../../realtime/emit';
import { UserModel } from '../users/user.model';
import { EmergencyCaseModel, type EmergencyCaseDoc } from './emergency.model';
import { EmergencyEventModel } from './emergency-event.model';

// NOTE (spec §20): this module must NEVER import or touch the queue module.
// The normal patient queue stays completely independent of emergency handling.

export type TriageInput = z.infer<typeof emergencyTriageSchema>;
export type TransitionInput = z.infer<typeof emergencyTransitionSchema>;
export type AssignInput = z.infer<typeof emergencyAssignSchema>;
export type ReferralInput = z.infer<typeof emergencyReferralSchema>;
export type ObservationInput = z.infer<typeof emergencyObservationSchema>;

export interface ServiceContext {
  tenant: NonNullable<Request['tenant']>;
  actor: NonNullable<Request['auth']>;
}

export interface EmergencyEventSummary {
  id: string;
  action: string;
  fromStatus?: EmergencyStatus;
  toStatus?: EmergencyStatus;
  actorUserId?: string;
  actorName?: string;
  notes?: string;
  createdAt: string;
}

type EmergencyCase = HydratedDocument<EmergencyCaseDoc>;

/** Board-friendly hint of what needs to happen next, keyed by current status. */
const NEXT_ACTION: Record<EmergencyStatus, string | undefined> = {
  awaiting_triage: 'Awaiting triage',
  triage_in_progress: 'Confirm priority',
  doctor_alerted: 'Awaiting doctor response',
  doctor_responding: 'Doctor en route',
  under_assessment: 'Under assessment',
  treatment_in_progress: 'Treatment in progress',
  under_observation: 'Under observation',
  referral_required: 'Arrange referral',
  transfer_arranging: 'Arranging transfer',
  transferred: 'Transfer complete — close case',
  discharged: 'Complete discharge paperwork',
  follow_up_required: 'Schedule follow-up',
  closed: undefined,
};

/** Quick-entry identity may be partial or unknown (spec §18). */
function derivePatientLabel(input: CreateEmergencyInput): string {
  const name = input.name?.trim();
  if (name) return name;
  const bits: string[] = [];
  if (input.gender && input.gender !== 'unknown') {
    bits.push(input.gender.charAt(0).toUpperCase() + input.gender.slice(1));
  }
  if (input.approximateAge !== undefined) bits.push(`approx. ${input.approximateAge}y`);
  return bits.length > 0 ? `Unidentified (${bits.join(', ')})` : 'Unidentified';
}

async function resolveNames(
  docs: Array<Pick<EmergencyCaseDoc, 'assignedDoctorId' | 'assignedNurseId'>>,
): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const doc of docs) {
    if (doc.assignedDoctorId) ids.add(doc.assignedDoctorId.toString());
    if (doc.assignedNurseId) ids.add(doc.assignedNurseId.toString());
  }
  if (ids.size === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: [...ids] } }, 'name').lean();
  return new Map(users.map((u) => [u._id.toString(), u.name]));
}

function toDto(doc: EmergencyCaseDoc, names: Map<string, string>): EmergencyCaseDto {
  return {
    id: doc._id.toString(),
    caseCode: doc.caseCode,
    branchId: doc.branchId!.toString(),
    patientId: doc.patientId?.toString(),
    patientLabel: doc.patientLabel,
    approximateAge: doc.approximateAge,
    gender: doc.gender,
    arrivalAt: doc.arrivalAt.toISOString(),
    arrivalMode: doc.arrivalMode,
    mainConcern: doc.mainConcern,
    status: doc.status,
    priority: doc.priority,
    priorityConfirmedBy: doc.priorityConfirmedByUserId?.toString(),
    assignedNurseId: doc.assignedNurseId?.toString(),
    assignedNurseName: doc.assignedNurseId ? names.get(doc.assignedNurseId.toString()) : undefined,
    assignedDoctorId: doc.assignedDoctorId?.toString(),
    assignedDoctorName: doc.assignedDoctorId ? names.get(doc.assignedDoctorId.toString()) : undefined,
    latestVitalsSummary: doc.latestVitalsSummary,
    nextAction: NEXT_ACTION[doc.status],
    createdAt: doc.createdAt.toISOString(),
  };
}

async function toDtoWithNames(doc: EmergencyCaseDoc): Promise<EmergencyCaseDto> {
  return toDto(doc, await resolveNames([doc]));
}

async function findCaseOrThrow(ctx: ServiceContext, id: string): Promise<EmergencyCase> {
  if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Emergency case');
  const doc = await EmergencyCaseModel.findOne({
    _id: id,
    organizationId: ctx.tenant.organizationId,
    clinicId: ctx.tenant.clinicId,
    branchId: ctx.tenant.branchId,
    deletedAt: null,
  });
  if (!doc) throw new NotFoundError('Emergency case');
  return doc;
}

interface RecordEventInput {
  action: string;
  fromStatus?: EmergencyStatus;
  toStatus?: EmergencyStatus;
  notes?: string;
}

/** Append an immutable audit-trail entry (spec §19). There is no update/delete path. */
async function recordEvent(ctx: ServiceContext, doc: EmergencyCase, input: RecordEventInput): Promise<void> {
  await EmergencyEventModel.create({
    organizationId: ctx.tenant.organizationId,
    clinicId: ctx.tenant.clinicId,
    branchId: ctx.tenant.branchId,
    emergencyCaseId: doc._id,
    action: input.action,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorUserId: ctx.actor.userId,
    actorName: ctx.actor.name,
    notes: input.notes,
  });
}

/**
 * The doctor-alert must read as genuinely urgent and distinct from ordinary queue
 * notifications: it goes to the whole branch room AND to the assigned doctor's
 * personal room (if one is already assigned).
 */
function emitDoctorAlert(ctx: ServiceContext, doc: EmergencyCase, dto: EmergencyCaseDto): void {
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT, dto);
  if (doc.assignedDoctorId) {
    emitToUser(doc.assignedDoctorId, SOCKET_EVENTS.EMERGENCY_DOCTOR_ALERT, dto);
  }
}

/**
 * Quick-entry creation (spec §18). NEVER requires patientId, mobile, or full identity —
 * only mainConcern is truly required by the schema. Priority always starts unconfirmed.
 */
export async function createEmergency(
  ctx: ServiceContext,
  input: CreateEmergencyInput,
): Promise<EmergencyCaseDto> {
  const localDate = todayInTimezone(ctx.tenant.timezone);
  const year = localDate.slice(0, 4);
  const seq = await nextSequence(`emergency:${ctx.tenant.clinicId.toString()}:${year}`);
  const caseCode = `ER-${year}-${String(seq).padStart(4, '0')}`;

  const doc = await EmergencyCaseModel.create({
    organizationId: ctx.tenant.organizationId,
    clinicId: ctx.tenant.clinicId,
    branchId: ctx.tenant.branchId,
    caseCode,
    patientId: input.patientId ? new Types.ObjectId(input.patientId) : undefined,
    patientLabel: derivePatientLabel(input),
    approximateAge: input.approximateAge,
    gender: input.gender,
    arrivalAt: input.arrivalAt ? new Date(input.arrivalAt) : new Date(),
    arrivalMode: input.arrivalMode,
    mainConcern: input.mainConcern,
    mobile: input.mobile,
    address: input.address,
    emergencyContact: input.emergencyContact,
    status: 'awaiting_triage',
    priority: 'unconfirmed',
  });

  await recordEvent(ctx, doc, { action: 'arrival', toStatus: 'awaiting_triage' });

  const dto = await toDtoWithNames(doc);
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_CREATED, dto);
  return dto;
}

export async function getEmergency(ctx: ServiceContext, id: string): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);
  return toDtoWithNames(doc);
}

/** Active board (spec §20): status !== closed, oldest arrival first. Never touches the queue. */
export async function listBoard(
  ctx: ServiceContext,
  status?: EmergencyStatus,
): Promise<EmergencyCaseDto[]> {
  const filter: Record<string, unknown> = {
    organizationId: ctx.tenant.organizationId,
    clinicId: ctx.tenant.clinicId,
    branchId: ctx.tenant.branchId,
    deletedAt: null,
    status: status ?? { $ne: 'closed' },
  };
  const docs = await EmergencyCaseModel.find(filter).sort({ arrivalAt: 1 });
  const names = await resolveNames(docs);
  return docs.map((doc) => toDto(doc, names));
}

export async function listEvents(ctx: ServiceContext, id: string): Promise<EmergencyEventSummary[]> {
  await findCaseOrThrow(ctx, id);
  const events = await EmergencyEventModel.find({
    clinicId: ctx.tenant.clinicId,
    emergencyCaseId: id,
  })
    .sort({ createdAt: 1 })
    .lean();
  return events.map((e) => ({
    id: e._id.toString(),
    action: e.action,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    actorUserId: e.actorUserId?.toString(),
    actorName: e.actorName,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));
}

/**
 * Priority is always assigned/confirmed by authorized clinical staff — never computed
 * (spec §2.4, §18). Advances awaiting_triage → triage_in_progress on first triage.
 */
export async function triageEmergency(
  ctx: ServiceContext,
  id: string,
  input: TriageInput,
): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);
  const from = doc.status;

  doc.priority = input.priority;
  doc.priorityConfirmedByUserId = ctx.actor.userId;

  let toStatus: EmergencyStatus | undefined;
  if (doc.status === 'awaiting_triage') {
    if (!canTransitionEmergency(doc.status, 'triage_in_progress')) {
      throw new InvalidTransitionError(doc.status, 'triage_in_progress');
    }
    doc.status = 'triage_in_progress';
    toStatus = 'triage_in_progress';
  }

  await doc.save();
  await recordEvent(ctx, doc, {
    action: 'triage',
    fromStatus: toStatus ? from : undefined,
    toStatus,
    notes: input.notes,
  });

  const dto = await toDtoWithNames(doc);
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_UPDATED, dto);
  return dto;
}

/** Every transition is audited (spec §19) — an EmergencyEvent is appended for every call. */
export async function transitionEmergency(
  ctx: ServiceContext,
  id: string,
  input: TransitionInput,
): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);
  const from = doc.status;
  if (!canTransitionEmergency(from, input.to)) {
    throw new InvalidTransitionError(from, input.to);
  }

  doc.status = input.to;
  await doc.save();
  await recordEvent(ctx, doc, { action: input.to, fromStatus: from, toStatus: input.to, notes: input.notes });

  const dto = await toDtoWithNames(doc);
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_UPDATED, dto);
  if (input.to === 'doctor_alerted') {
    emitDoctorAlert(ctx, doc, dto);
  }
  return dto;
}

/**
 * Assigns doctor/nurse. If a doctor is assigned and the case can validly move to
 * doctor_alerted, apply that transition too — otherwise just assign, without forcing it.
 */
export async function assignEmergency(
  ctx: ServiceContext,
  id: string,
  input: AssignInput,
): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);

  if (input.doctorId) doc.assignedDoctorId = new Types.ObjectId(input.doctorId);
  if (input.nurseId) doc.assignedNurseId = new Types.ObjectId(input.nurseId);
  await doc.save();
  await recordEvent(ctx, doc, { action: 'assigned' });

  let alerted = false;
  if (input.doctorId && canTransitionEmergency(doc.status, 'doctor_alerted')) {
    const from = doc.status;
    doc.status = 'doctor_alerted';
    await doc.save();
    await recordEvent(ctx, doc, { action: 'doctor_alerted', fromStatus: from, toStatus: 'doctor_alerted' });
    alerted = true;
  }

  const dto = await toDtoWithNames(doc);
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_UPDATED, dto);
  if (alerted) emitDoctorAlert(ctx, doc, dto);
  return dto;
}

/**
 * Sets the referral details and moves toward referral_required / transfer_arranging
 * only when that transition is currently valid; otherwise just records the referral
 * details without forcing a status change.
 */
export async function referEmergency(
  ctx: ServiceContext,
  id: string,
  input: ReferralInput,
): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);
  doc.referral = {
    facilityName: input.facilityName,
    reason: input.reason,
    notes: input.notes,
    transportMode: input.transportMode,
  };

  const from = doc.status;
  let to: EmergencyStatus | undefined;
  if (canTransitionEmergency(from, 'referral_required')) to = 'referral_required';
  else if (canTransitionEmergency(from, 'transfer_arranging')) to = 'transfer_arranging';
  if (to) doc.status = to;

  await doc.save();
  await recordEvent(ctx, doc, {
    action: 'referral_initiated',
    fromStatus: to ? from : undefined,
    toStatus: to,
    notes: input.notes ?? `${input.facilityName}: ${input.reason}`,
  });

  const dto = await toDtoWithNames(doc);
  emitToBranch(ctx.tenant.branchId, SOCKET_EVENTS.EMERGENCY_UPDATED, dto);
  return dto;
}

/**
 * Observation notes can be added repeatedly (e.g. while under_observation) WITHOUT
 * necessarily changing status.
 */
export async function addObservationNote(
  ctx: ServiceContext,
  id: string,
  input: ObservationInput,
): Promise<EmergencyCaseDto> {
  const doc = await findCaseOrThrow(ctx, id);
  await recordEvent(ctx, doc, { action: 'observation_note', notes: input.note });
  return toDtoWithNames(doc);
}

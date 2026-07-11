import { Types } from 'mongoose';
import type {
  DisplayState,
  Permission,
  QueueEntryDto,
  QueueStatus,
  RejoinPolicy,
} from '@clinicos/types';
import { PERMISSIONS, QUEUE_ACTIVE_STATUSES, QUEUE_BOARD_COLUMNS, canTransitionQueue } from '@clinicos/types';
import type { AddToQueueInput, QueueTransitionInput } from '@clinicos/validation';
import { DEFAULTS, computeAge, formatToken } from '@clinicos/config';
import { nextSequence } from '../../shared/sequence';
import { todayInTimezone } from '../../shared/dates';
import {
  ConflictError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors';
import { QueueEntryModel, type QueueEntryDoc } from './queue-entry.model';
import { QueueEventModel, type QueueEventAction } from './queue-event.model';
// Canonical path (spec §5 model registry) — the patients module is being built
// concurrently by another agent; this import resolves once that module lands.
import { PatientModel } from '../patients/patient.model';
import { UserModel } from '../users/user.model';

/** Tenant scoping, resolved by `tenantContext` — never trust clinicId/branchId from input. */
export interface TenantScope {
  organizationId: Types.ObjectId;
  clinicId: Types.ObjectId;
  branchId: Types.ObjectId;
  timezone: string;
}

/** Identity of whoever is performing the action, recorded on the immutable event log. */
export interface Actor {
  userId?: Types.ObjectId;
  name?: string;
  permissions?: ReadonlySet<Permission>;
}

export interface TransitionResult {
  entry: QueueEntryDoc;
  fromStatus: QueueStatus;
}

const REASON_REQUIRED_STATUSES: readonly QueueStatus[] = ['skipped', 'no_show', 'cancelled'];
const AUTO_CHECKED_IN_SOURCES = new Set<AddToQueueInput['source']>(['appointment', 'walk_in', 'quick_entry']);

function toObjectId(id: string | Types.ObjectId): Types.ObjectId {
  return typeof id === 'string' ? new Types.ObjectId(id) : id;
}

async function writeEvent(
  tenant: TenantScope,
  actor: Actor,
  entry: Pick<QueueEntryDoc, '_id' | 'status'>,
  fields: { fromStatus?: QueueStatus; toStatus: QueueStatus; action: QueueEventAction; reason?: string },
): Promise<void> {
  await QueueEventModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    queueEntryId: entry._id,
    fromStatus: fields.fromStatus,
    toStatus: fields.toStatus,
    action: fields.action,
    reason: fields.reason,
    actorUserId: actor.userId,
    actorName: actor.name,
  });
}

async function getEntryOrThrow(tenant: TenantScope, entryId: string) {
  if (!Types.ObjectId.isValid(entryId)) throw new NotFoundError('Queue entry');
  const entry = await QueueEntryModel.findOne({
    _id: entryId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    deletedAt: null,
  });
  if (!entry) throw new NotFoundError('Queue entry');
  return entry;
}

async function nextPositionForDay(tenant: TenantScope, date: string): Promise<number> {
  const last = await QueueEntryModel.findOne({
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date,
    deletedAt: null,
  })
    .sort({ position: -1 })
    .select('position')
    .lean<{ position: number } | null>();
  return (last?.position ?? -1) + 1;
}

/**
 * Adds a patient to today's live queue and mints their token (spec §14-15).
 *
 * The public `addToQueueSchema` deliberately has no `status` field — reception staff
 * never choose a starting status by hand. `appointment` / `walk_in` / `quick_entry`
 * always start `checked_in`. Other sources (e.g. a case forwarded programmatically
 * from the emergency or appointments module) may pass `initialStatusOverride` when
 * calling this service function directly; that is the "caller-provided" branch — it
 * has no HTTP-body equivalent because only trusted server code, not the browser,
 * decides a non-default starting status.
 */
export async function addToQueue(
  tenant: TenantScope,
  actor: Actor,
  input: AddToQueueInput,
  initialStatusOverride?: QueueStatus,
): Promise<QueueEntryDoc> {
  const date = todayInTimezone(tenant.timezone);
  const tokenKey = 'token:' + tenant.branchId.toString() + ':' + date;
  const seq = await nextSequence(tokenKey);
  const token = formatToken(DEFAULTS.TOKEN_PREFIX, seq);

  const initialStatus: QueueStatus = AUTO_CHECKED_IN_SOURCES.has(input.source)
    ? 'checked_in'
    : (initialStatusOverride ?? 'checked_in');

  const position = await nextPositionForDay(tenant, date);

  const entry = await QueueEntryModel.create({
    organizationId: tenant.organizationId,
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date,
    token,
    patientId: toObjectId(input.patientId),
    appointmentId: input.appointmentId ? toObjectId(input.appointmentId) : undefined,
    source: input.source,
    doctorId: input.doctorId ? toObjectId(input.doctorId) : undefined,
    status: initialStatus,
    presence: 'present',
    priority: input.priority ?? 0,
    position,
    reasonForVisit: input.reasonForVisit,
    checkedInAt: initialStatus === 'checked_in' ? new Date() : undefined,
    version: 0,
  });

  await writeEvent(tenant, actor, entry, { toStatus: entry.status, action: 'created' });

  return entry;
}

/**
 * PATCH /queues/:id/transition — generic state-machine move (spec §35 for optimistic
 * concurrency). `skipped` / `no_show` / `cancelled` require a reason; the caller
 * (controller) is responsible for auditing those.
 */
export async function transitionEntry(
  tenant: TenantScope,
  actor: Actor,
  entryId: string,
  input: QueueTransitionInput,
): Promise<TransitionResult> {
  const entry = await getEntryOrThrow(tenant, entryId);

  if (!canTransitionQueue(entry.status, input.to)) {
    throw new InvalidTransitionError(entry.status, input.to);
  }
  if (input.expectedVersion !== undefined && input.expectedVersion !== entry.version) {
    throw new ConflictError('This queue entry was updated elsewhere. Refresh and try again.');
  }
  if (REASON_REQUIRED_STATUSES.includes(input.to) && !input.reason) {
    throw new ValidationError([{ field: 'reason', message: 'Reason is required for this transition.' }]);
  }

  const fromStatus = entry.status;
  entry.status = input.to;
  entry.version += 1;
  if (input.to === 'checked_in' && !entry.checkedInAt) entry.checkedInAt = new Date();
  if (input.to === 'in_consultation') entry.consultationStartedAt = new Date();
  if (input.to === 'consultation_completed') entry.consultationCompletedAt = new Date();
  await entry.save();

  await writeEvent(tenant, actor, entry, {
    fromStatus,
    toStatus: entry.status,
    action: 'transition',
    reason: input.reason,
  });

  return { entry, fromStatus };
}

/** POST /queues/:id/skip — always audited by the controller. */
export async function skipEntry(
  tenant: TenantScope,
  actor: Actor,
  entryId: string,
  reason: string,
): Promise<TransitionResult> {
  const entry = await getEntryOrThrow(tenant, entryId);
  if (!canTransitionQueue(entry.status, 'skipped')) {
    throw new InvalidTransitionError(entry.status, 'skipped');
  }

  const fromStatus = entry.status;
  entry.status = 'skipped';
  entry.presence = 'skipped';
  entry.version += 1;
  await entry.save();

  await writeEvent(tenant, actor, entry, { fromStatus, toStatus: 'skipped', action: 'skip', reason });

  return { entry, fromStatus };
}

export interface RejoinInput {
  policy?: RejoinPolicy;
  manualPosition?: number;
  reason: string;
}

async function computeRejoinPosition(
  tenant: TenantScope,
  entry: QueueEntryDoc,
  policy: RejoinPolicy,
  manualPosition?: number,
): Promise<number> {
  if (policy === 'manual') return manualPosition as number;

  const baseFilter: Record<string, unknown> = {
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date: entry.date,
    deletedAt: null,
    status: { $in: QUEUE_ACTIVE_STATUSES },
    _id: { $ne: entry._id },
    doctorId: entry.doctorId ?? null,
  };

  if (policy === 'end_of_priority_group') {
    const last = await QueueEntryModel.findOne({ ...baseFilter, priority: entry.priority })
      .sort({ position: -1 })
      .select('position')
      .lean<{ position: number } | null>();
    return (last?.position ?? entry.position) + 1;
  }

  const first = await QueueEntryModel.findOne(baseFilter)
    .sort({ position: 1 })
    .select('position')
    .lean<{ position: number } | null>();
  const firstPosition = first?.position ?? entry.position;
  const offset = policy === 'after_two_patients' ? 2 : 1;
  return firstPosition + offset;
}

/** POST /queues/:id/rejoin — always audited by the controller. */
export async function rejoinEntry(
  tenant: TenantScope,
  actor: Actor,
  entryId: string,
  input: RejoinInput,
): Promise<TransitionResult> {
  const entry = await getEntryOrThrow(tenant, entryId);
  if (!canTransitionQueue(entry.status, 'rejoined')) {
    throw new InvalidTransitionError(entry.status, 'rejoined');
  }

  const policy: RejoinPolicy = input.policy ?? DEFAULTS.REJOIN_POLICY;
  if (policy === 'manual') {
    if (!actor.permissions?.has(PERMISSIONS.QUEUE_OVERRIDE)) {
      throw new ForbiddenError('Manual queue placement requires override permission.');
    }
    if (input.manualPosition === undefined) {
      throw new ValidationError([
        { field: 'manualPosition', message: 'manualPosition is required for manual placement.' },
      ]);
    }
  }

  const fromStatus = entry.status;
  const newPosition = await computeRejoinPosition(tenant, entry, policy, input.manualPosition);

  entry.status = 'rejoined';
  entry.presence = 'rejoined';
  entry.position = newPosition;
  entry.version += 1;
  await entry.save();

  await writeEvent(tenant, actor, entry, { fromStatus, toStatus: 'rejoined', action: 'rejoin', reason: input.reason });

  return { entry, fromStatus };
}

export interface TransferInput {
  doctorId: string;
  reason: string;
}

/** POST /queues/:id/transfer — requires PERMISSIONS.QUEUE_OVERRIDE (enforced at the route). */
export async function transferDoctor(
  tenant: TenantScope,
  actor: Actor,
  entryId: string,
  input: TransferInput,
): Promise<TransitionResult> {
  const entry = await getEntryOrThrow(tenant, entryId);

  entry.doctorId = toObjectId(input.doctorId);
  entry.version += 1;
  await entry.save();

  await writeEvent(tenant, actor, entry, {
    fromStatus: entry.status,
    toStatus: entry.status,
    action: 'transfer_doctor',
    reason: input.reason,
  });

  return { entry, fromStatus: entry.status };
}

export interface CallInput {
  room?: string;
}

/** POST /queues/:id/call — marks presence 'called'; the socket payload never carries a name. */
export async function callPatient(tenant: TenantScope, entryId: string): Promise<QueueEntryDoc> {
  const entry = await getEntryOrThrow(tenant, entryId);
  entry.presence = 'called';
  entry.version += 1;
  await entry.save();
  return entry;
}

export interface BoardQuery {
  date?: string;
  doctorId?: string;
}

export interface BoardResult {
  date: string;
  columns: Record<(typeof QUEUE_BOARD_COLUMNS)[number], QueueEntryDoc[]>;
}

/** GET /queues?view=board — Kanban columns, sorted priority desc then position/arrival asc. */
export async function getBoard(tenant: TenantScope, query: BoardQuery): Promise<BoardResult> {
  const date = query.date ?? todayInTimezone(tenant.timezone);
  const filter: Record<string, unknown> = {
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date,
    status: { $in: QUEUE_BOARD_COLUMNS },
    deletedAt: null,
  };
  if (query.doctorId) filter.doctorId = toObjectId(query.doctorId);

  const entries = await QueueEntryModel.find(filter).lean<QueueEntryDoc[]>();
  entries.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.position !== b.position) return a.position - b.position;
    const aTime = a.checkedInAt ? new Date(a.checkedInAt).getTime() : 0;
    const bTime = b.checkedInAt ? new Date(b.checkedInAt).getTime() : 0;
    return aTime - bTime;
  });

  const columns = Object.fromEntries(QUEUE_BOARD_COLUMNS.map((col) => [col, [] as QueueEntryDoc[]])) as BoardResult['columns'];
  for (const entry of entries) {
    columns[entry.status as (typeof QUEUE_BOARD_COLUMNS)[number]]?.push(entry);
  }

  return { date, columns };
}

export interface ListQuery {
  date?: string;
  doctorId?: string;
  status?: QueueStatus;
}

export interface ListResult {
  date: string;
  items: QueueEntryDoc[];
  total: number;
}

/** GET /queues?view=list — flat, paginated. */
export async function getList(
  tenant: TenantScope,
  query: ListQuery,
  pagination: { skip: number; limit: number },
): Promise<ListResult> {
  const date = query.date ?? todayInTimezone(tenant.timezone);
  const filter: Record<string, unknown> = {
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date,
    deletedAt: null,
  };
  if (query.doctorId) filter.doctorId = toObjectId(query.doctorId);
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    QueueEntryModel.find(filter).sort({ position: 1 }).skip(pagination.skip).limit(pagination.limit).lean<QueueEntryDoc[]>(),
    QueueEntryModel.countDocuments(filter),
  ]);

  return { date, items, total };
}

export interface WaitEstimate {
  min: number;
  max: number;
}

/**
 * Wait-time estimate — always a RANGE, never an exact number (spec §15). Only
 * meaningful for entries in an active status; callers should skip this for terminal
 * statuses (completed/cancelled/no_show/etc).
 */
export async function estimateWait(
  tenant: TenantScope,
  entry: Pick<QueueEntryDoc, 'doctorId' | 'position' | 'date' | 'status'>,
  now: Date = new Date(),
): Promise<WaitEstimate | undefined> {
  if (!QUEUE_ACTIVE_STATUSES.includes(entry.status)) return undefined;

  const doctorFilter: Record<string, unknown> = {
    clinicId: tenant.clinicId,
    branchId: tenant.branchId,
    date: entry.date,
    deletedAt: null,
    doctorId: entry.doctorId ?? null,
  };

  const activePatientsAhead = await QueueEntryModel.countDocuments({
    ...doctorFilter,
    status: { $in: QUEUE_ACTIVE_STATUSES },
    position: { $lt: entry.position },
  });

  const recentCompleted = await QueueEntryModel.find({
    ...doctorFilter,
    consultationStartedAt: { $ne: null },
    consultationCompletedAt: { $ne: null },
  })
    .sort({ consultationCompletedAt: -1 })
    .limit(10)
    .select('consultationStartedAt consultationCompletedAt')
    .lean<Array<{ consultationStartedAt: Date; consultationCompletedAt: Date }>>();

  let avgMinutes: number = DEFAULTS.AVG_CONSULTATION_MINUTES;
  if (recentCompleted.length > 0) {
    const totalMinutes = recentCompleted.reduce((sum, e) => {
      const durationMs = new Date(e.consultationCompletedAt).getTime() - new Date(e.consultationStartedAt).getTime();
      return sum + Math.max(0, durationMs / 60_000);
    }, 0);
    avgMinutes = totalMinutes / recentCompleted.length;
  }

  let base = activePatientsAhead * avgMinutes;

  const inProgress = await QueueEntryModel.findOne({ ...doctorFilter, status: 'in_consultation' })
    .select('consultationStartedAt')
    .lean<{ consultationStartedAt?: Date } | null>();
  if (inProgress?.consultationStartedAt) {
    const elapsedMinutes = Math.max(0, (now.getTime() - new Date(inProgress.consultationStartedAt).getTime()) / 60_000);
    base = Math.max(0, base - elapsedMinutes);
  }

  const spread = base * DEFAULTS.WAIT_ESTIMATE_SPREAD_RATIO;
  return {
    min: Math.max(0, Math.round(base - spread)),
    max: Math.round(base + spread),
  };
}

interface PatientProjection {
  _id: Types.ObjectId;
  code: string;
  fullName: string;
  dateOfBirth?: string | Date;
  approximateAge?: number;
}

/** Maps entries to the full staff-facing DTO — joins patient name/code/age (staff only). */
export async function toStaffDtos(
  tenant: TenantScope,
  entries: QueueEntryDoc[],
  now: Date = new Date(),
): Promise<QueueEntryDto[]> {
  if (entries.length === 0) return [];

  const patientIds = [...new Set(entries.map((e) => e.patientId.toString()))];
  const doctorIds = [...new Set(entries.filter((e) => e.doctorId).map((e) => e.doctorId!.toString()))];

  const [patients, doctors] = await Promise.all([
    PatientModel.find({ _id: { $in: patientIds }, clinicId: tenant.clinicId })
      .select('code fullName dateOfBirth approximateAge')
      .lean<PatientProjection[]>(),
    doctorIds.length
      ? UserModel.find({ _id: { $in: doctorIds } }).select('name').lean<Array<{ _id: Types.ObjectId; name: string }>>()
      : Promise.resolve([]),
  ]);

  const patientMap = new Map(patients.map((p) => [p._id.toString(), p]));
  const doctorMap = new Map(doctors.map((d) => [d._id.toString(), d.name]));

  const dtos: QueueEntryDto[] = [];
  for (const entry of entries) {
    const patient = patientMap.get(entry.patientId.toString());
    const estimate = await estimateWait(tenant, entry, now);
    dtos.push({
      id: entry._id.toString(),
      branchId: entry.branchId!.toString(),
      date: entry.date,
      token: entry.token,
      patientId: entry.patientId.toString(),
      patientName: patient?.fullName,
      patientCode: patient?.code,
      age: patient ? computeAge(patient.dateOfBirth, patient.approximateAge) : undefined,
      source: entry.source,
      doctorId: entry.doctorId?.toString(),
      doctorName: entry.doctorId ? doctorMap.get(entry.doctorId.toString()) : undefined,
      status: entry.status,
      presence: entry.presence,
      priority: entry.priority,
      position: entry.position,
      reasonForVisit: entry.reasonForVisit,
      checkedInAt: entry.checkedInAt?.toISOString(),
      estimatedWaitMinMinutes: estimate?.min,
      estimatedWaitMaxMinutes: estimate?.max,
      consultationStartedAt: entry.consultationStartedAt?.toISOString(),
      version: entry.version,
      createdAt: entry.createdAt.toISOString(),
    });
  }
  return dtos;
}

export async function toStaffDto(tenant: TenantScope, entry: QueueEntryDoc, now: Date = new Date()): Promise<QueueEntryDto> {
  const [dto] = await toStaffDtos(tenant, [entry], now);
  return dto as QueueEntryDto;
}

/**
 * Builds the privacy-safe waiting-room display payload (spec §17). MUST NEVER include
 * patient names — only tokens, doctor labels and aggregate flags.
 */
export async function buildDisplayState(tenant: TenantScope, branchId: Types.ObjectId, date: string): Promise<DisplayState> {
  const consultingEntries = await QueueEntryModel.find({
    clinicId: tenant.clinicId,
    branchId,
    date,
    status: 'in_consultation',
    deletedAt: null,
  })
    .select('token doctorId')
    .lean<Array<{ token: string; doctorId?: Types.ObjectId }>>();

  const doctorIds = [...new Set(consultingEntries.filter((e) => e.doctorId).map((e) => e.doctorId!.toString()))];
  const doctors = doctorIds.length
    ? await UserModel.find({ _id: { $in: doctorIds } }).select('name').lean<Array<{ _id: Types.ObjectId; name: string }>>()
    : [];
  const doctorMap = new Map(doctors.map((d) => [d._id.toString(), d.name]));

  const nowConsulting = consultingEntries.map((e) => ({
    token: e.token,
    doctorLabel: (e.doctorId && doctorMap.get(e.doctorId.toString())) || 'Doctor',
  }));

  const nextEntries = await QueueEntryModel.find({
    clinicId: tenant.clinicId,
    branchId,
    date,
    status: { $in: QUEUE_ACTIVE_STATUSES },
    deletedAt: null,
  })
    .sort({ priority: -1, position: 1 })
    .limit(5)
    .select('token')
    .lean<Array<{ token: string }>>();

  const delayedCount = await QueueEntryModel.countDocuments({
    clinicId: tenant.clinicId,
    branchId,
    date,
    status: 'delayed',
    deletedAt: null,
  });

  return {
    branchId: branchId.toString(),
    nowConsulting,
    nextTokens: nextEntries.map((e) => e.token),
    delayed: delayedCount > 0,
    updatedAt: new Date().toISOString(),
  };
}

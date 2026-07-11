import type { Request, Response } from 'express';
import type { RejoinPolicy, QueueEntryChangedPayload, QueueEntryDto, QueueStatus } from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import type { AddToQueueInput, QueueTransitionInput } from '@clinicos/validation';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { UnauthenticatedError } from '../../shared/errors';
import { emitToBranch, emitToDisplay } from '../../realtime/emit';
import { parsePagination } from '../../shared/pagination';
import * as service from './queue.service';
import type { Actor, TenantScope } from './queue.service';
import type { QueueEntryDoc } from './queue-entry.model';

interface SkipBody {
  reason: string;
}

interface RejoinBody {
  policy?: RejoinPolicy;
  manualPosition?: number;
  reason: string;
}

interface TransferBody {
  doctorId: string;
  reason: string;
}

interface CallBody {
  room?: string;
}

interface QueueListQueryParsed {
  date?: string;
  doctorId?: string;
  status?: QueueStatus;
  view: 'board' | 'list';
}

function requireTenant(req: Request): TenantScope {
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
    timezone: req.tenant.timezone,
  };
}

function actorFrom(req: Request): Actor {
  return {
    userId: req.auth?.userId,
    name: req.auth?.name,
    permissions: req.tenant?.permissions,
  };
}

/** Refreshes the branch board + the privacy-safe waiting-room display for one day. */
async function broadcastDisplayAndBoard(tenant: TenantScope, date: string): Promise<void> {
  emitToBranch(tenant.branchId, SOCKET_EVENTS.QUEUE_UPDATED, { branchId: tenant.branchId.toString(), date });
  const displayState = await service.buildDisplayState(tenant, tenant.branchId, date);
  emitToDisplay(tenant.branchId, SOCKET_EVENTS.DISPLAY_STATE, displayState);
}

function emitEntryChanged(tenant: TenantScope, entry: Pick<QueueEntryDoc, '_id' | 'doctorId' | 'status' | 'token'>): void {
  const payload: QueueEntryChangedPayload = {
    entryId: entry._id.toString(),
    branchId: tenant.branchId.toString(),
    doctorId: entry.doctorId?.toString(),
    status: entry.status,
    token: entry.token,
  };
  emitToBranch(tenant.branchId, SOCKET_EVENTS.QUEUE_ENTRY_CHANGED, payload);
}

/** POST /queues — add a patient to today's live queue and mint a token. */
export async function addToQueue(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const input = req.body as AddToQueueInput;

  const entry = await service.addToQueue(tenant, actorFrom(req), input);
  const dto = await service.toStaffDto(tenant, entry);

  await broadcastDisplayAndBoard(tenant, entry.date);

  created(res, dto);
}

/** PATCH /queues/:id/transition — generic state-machine move with optimistic concurrency. */
export async function transition(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const input = req.body as QueueTransitionInput;
  const entryId = req.params.id as string;

  const { entry, fromStatus } = await service.transitionEntry(tenant, actorFrom(req), entryId, input);

  if (input.to === 'skipped' || input.to === 'no_show' || input.to === 'cancelled') {
    await audit(req, {
      action: `queue.${input.to}`,
      resource: 'queue_entry',
      resourceId: entry._id.toString(),
      before: { status: fromStatus },
      after: { status: entry.status },
      reason: input.reason,
    });
  }

  emitEntryChanged(tenant, entry);
  await broadcastDisplayAndBoard(tenant, entry.date);

  const dto = await service.toStaffDto(tenant, entry);
  ok(res, dto);
}

/** POST /queues/:id/skip — always audited. */
export async function skip(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const { reason } = req.body as SkipBody;
  const entryId = req.params.id as string;

  const { entry, fromStatus } = await service.skipEntry(tenant, actorFrom(req), entryId, reason);

  await audit(req, {
    action: 'queue.skip',
    resource: 'queue_entry',
    resourceId: entry._id.toString(),
    before: { status: fromStatus },
    after: { status: entry.status },
    reason,
  });

  emitEntryChanged(tenant, entry);
  await broadcastDisplayAndBoard(tenant, entry.date);

  const dto = await service.toStaffDto(tenant, entry);
  ok(res, dto);
}

/** POST /queues/:id/rejoin — always audited; manual placement additionally needs QUEUE_OVERRIDE. */
export async function rejoin(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const body = req.body as RejoinBody;
  const entryId = req.params.id as string;

  const { entry, fromStatus } = await service.rejoinEntry(tenant, actorFrom(req), entryId, body);

  await audit(req, {
    action: 'queue.rejoin',
    resource: 'queue_entry',
    resourceId: entry._id.toString(),
    before: { status: fromStatus },
    after: { status: entry.status, position: entry.position },
    reason: body.reason,
  });

  emitEntryChanged(tenant, entry);
  await broadcastDisplayAndBoard(tenant, entry.date);

  const dto = await service.toStaffDto(tenant, entry);
  ok(res, dto);
}

/** POST /queues/:id/transfer — requires QUEUE_OVERRIDE (enforced at the route); always audited. */
export async function transferDoctor(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const body = req.body as TransferBody;
  const entryId = req.params.id as string;

  const { entry } = await service.transferDoctor(tenant, actorFrom(req), entryId, body);

  await audit(req, {
    action: 'queue.transfer_doctor',
    resource: 'queue_entry',
    resourceId: entry._id.toString(),
    after: { doctorId: entry.doctorId?.toString() },
    reason: body.reason,
  });

  emitEntryChanged(tenant, entry);
  await broadcastDisplayAndBoard(tenant, entry.date);

  const dto = await service.toStaffDto(tenant, entry);
  ok(res, dto);
}

/** POST /queues/:id/call — sets presence to 'called'; the socket payload never carries a name. */
export async function callPatient(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const { room } = req.body as CallBody;
  const entryId = req.params.id as string;

  const entry = await service.callPatient(tenant, entryId);

  emitToBranch(tenant.branchId, SOCKET_EVENTS.QUEUE_CALLED, { token: entry.token, room });
  emitToDisplay(tenant.branchId, SOCKET_EVENTS.QUEUE_CALLED, { token: entry.token, room });

  const dto = await service.toStaffDto(tenant, entry);
  ok(res, dto);
}

/** GET /queues?view=board|list */
export async function list(req: Request, res: Response): Promise<void> {
  const tenant = requireTenant(req);
  const query = req.query as unknown as QueueListQueryParsed;

  if (query.view === 'list') {
    const pagination = parsePagination(req);
    const { date, items, total } = await service.getList(tenant, query, pagination);
    const dtos = await service.toStaffDtos(tenant, items);
    ok(res, dtos, { page: pagination.page, limit: pagination.limit, total, date });
    return;
  }

  const { date, columns } = await service.getBoard(tenant, query);
  const board: Record<string, QueueEntryDto[]> = {};
  for (const [column, entries] of Object.entries(columns)) {
    board[column] = await service.toStaffDtos(tenant, entries);
  }
  ok(res, board, { date });
}

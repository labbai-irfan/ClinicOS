import type { Request, Response } from 'express';
import { PERMISSIONS } from '@clinicos/types';
import { appointmentListQuery } from '@clinicos/validation';
import { created, ok } from '../../shared/http';
import { ForbiddenError, UnauthenticatedError } from '../../shared/errors';
import { parsePagination } from '../../shared/pagination';
import * as service from './appointment.service';
import type { AppointmentStatusInput, CreateAppointmentInput, RescheduleAppointmentInput } from './appointment.service';

export async function create(req: Request, res: Response): Promise<void> {
  const dto = await service.createAppointment(req, req.body as CreateAppointmentInput);
  created(res, dto);
}

export async function list(req: Request, res: Response): Promise<void> {
  // Route-level `validate(appointmentListQuery, 'query')` already applied the schema;
  // re-parsing here just gives a properly typed object (page/limit stay untouched).
  const filters = appointmentListQuery.parse(req.query);
  const pagination = parsePagination(req);
  const { items, total } = await service.listAppointments(req, filters, pagination);
  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

export async function get(req: Request, res: Response): Promise<void> {
  const dto = await service.getAppointment(req, req.params.id as string);
  ok(res, dto);
}

export async function reschedule(req: Request, res: Response): Promise<void> {
  const dto = await service.rescheduleAppointment(
    req,
    req.params.id as string,
    req.body as RescheduleAppointmentInput,
  );
  ok(res, dto);
}

/**
 * Handles all status transitions, including cancellation. The route itself is
 * guarded loosely (APPOINTMENT_READ or APPOINTMENT_CREATE) so front-desk/queue
 * flows can move an appointment through confirmed/checked_in/late/no_show, but
 * cancelling specifically requires APPOINTMENT_CANCEL — checked here since it's
 * conditional on the requested status, not a blanket route permission.
 */
export async function changeStatus(req: Request, res: Response): Promise<void> {
  if (!req.tenant) throw new UnauthenticatedError();
  const input = req.body as AppointmentStatusInput;
  if (input.status === 'cancelled' && !req.tenant.permissions.has(PERMISSIONS.APPOINTMENT_CANCEL)) {
    throw new ForbiddenError('You do not have permission to cancel appointments.');
  }
  const dto = await service.changeAppointmentStatus(req, req.params.id as string, input);
  ok(res, dto);
}

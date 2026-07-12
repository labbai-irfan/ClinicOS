import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { ok, created } from '../../shared/http';
import { UnauthenticatedError, NotFoundError, ValidationError } from '../../shared/errors';
import { parsePagination } from '../../shared/pagination';
import { audit } from '../../shared/audit';
import * as service from './appointment.service';
import type { CreateAppointmentInput } from './appointment.service';

function requirePatientAuth(req: Request): { patientId: Types.ObjectId } {
  if (!req.auth) throw new UnauthenticatedError();
  // For patient endpoints, the authenticated user's ID IS the patient ID
  return { patientId: req.auth.userId };
}

/**
 * GET /appointments/patient/me
 * Retrieve appointments for the authenticated patient.
 * Query params: dateFrom?, dateTo?, status?
 */
export async function listPatientAppointments(req: Request, res: Response): Promise<void> {
  const { patientId } = requirePatientAuth(req);
  if (!req.tenant) throw new UnauthenticatedError();

  const { dateFrom, dateTo, status } = req.query as Record<string, string | undefined>;

  // Build filter for this patient's appointments
  const filters = {
    dateFrom,
    dateTo,
    status,
  };

  const pagination = parsePagination(req);
  const { items, total } = await service.listPatientAppointments(
    req,
    patientId,
    filters,
    pagination,
  );

  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

/**
 * POST /appointments/patient/book
 * Book a new appointment for the authenticated patient.
 * Body: {doctorId, branchId, startTime, endTime, reason}
 */
export async function bookPatientAppointment(req: Request, res: Response): Promise<void> {
  const { patientId } = requirePatientAuth(req);
  if (!req.tenant) throw new UnauthenticatedError();

  const { doctorId, branchId, startTime, endTime, reason } = req.body as Record<
    string,
    unknown
  >;

  // Validate required fields
  if (!doctorId || !branchId || !startTime || !endTime) {
    throw new ValidationError([
      { field: 'doctorId', message: 'Doctor ID is required' },
      { field: 'branchId', message: 'Branch ID is required' },
      { field: 'startTime', message: 'Start time is required' },
      { field: 'endTime', message: 'End time is required' },
    ]);
  }

  // Validate ObjectIds
  if (!Types.ObjectId.isValid(doctorId as string)) {
    throw new ValidationError([{ field: 'doctorId', message: 'Invalid doctor ID format' }]);
  }

  if (!Types.ObjectId.isValid(branchId as string)) {
    throw new ValidationError([{ field: 'branchId', message: 'Invalid branch ID format' }]);
  }

  // The portal sends wall-clock local datetimes (`${date}T${HH:mm}:00`, no timezone
  // suffix) — split them into the {date, windowStart, windowEnd} shape the shared
  // appointment service expects instead of treating the whole string as a time.
  const DATETIME_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;
  const startMatch = DATETIME_RE.exec(startTime as string);
  const endMatch = DATETIME_RE.exec(endTime as string);
  if (!startMatch || !endMatch) {
    throw new ValidationError([
      { field: 'startTime', message: 'startTime/endTime must be in YYYY-MM-DDTHH:mm format' },
    ]);
  }

  const input: CreateAppointmentInput = {
    patientId: patientId.toString(),
    doctorId: doctorId as string,
    date: startMatch[1]!,
    windowStart: startMatch[2]!,
    windowEnd: endMatch[2]!,
    type: 'new',
    reason: (reason as string) || '',
    overrideCapacity: false,
  };

  const dto = await service.createAppointment(req, input);
  await audit(req, {
    action: 'appointment.patient_booked',
    resource: 'appointment',
    resourceId: dto.id,
  });

  created(res, dto);
}

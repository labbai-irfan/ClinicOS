import type { Request, Response } from 'express';
import { ok } from '../../shared/http';
import { UnauthenticatedError } from '../../shared/errors';
import * as patientService from './patient.service';

function requirePatientAuth(req: Request): patientService.TenantContext {
  if (!req.auth) throw new UnauthenticatedError();
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
  };
}

/**
 * GET /patients/patient/me
 * Retrieve the authenticated patient's own profile.
 * Returns: name, email, phone, gender, dob, allergies, conditions
 */
export async function getPatientProfile(req: Request, res: Response): Promise<void> {
  const tenant = requirePatientAuth(req);
  // For patient endpoints, the authenticated user's ID IS the patient ID
  const patientId = req.auth!.userId.toString();

  const profile = await patientService.getProfile(tenant, patientId);
  ok(res, profile);
}

/**
 * PATCH /patient/me
 * Update the authenticated patient's own profile.
 */
export async function updatePatientProfile(req: Request, res: Response): Promise<void> {
  const tenant = requirePatientAuth(req);
  const patientId = req.auth!.userId.toString();

  const { after } = await patientService.update(tenant, patientId, req.body);
  ok(res, after);
}

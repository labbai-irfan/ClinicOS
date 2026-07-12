import type { NextFunction, Request, Response } from 'express';
import { UnauthenticatedError, NotFoundError } from '../shared/errors';
import { PatientModel } from '../modules/patients/patient.model';
import { ClinicModel } from '../modules/clinics/clinic.model';
import { asyncHandler } from '../shared/http';

/**
 * Resolves tenant context for patient-facing endpoints.
 * Unlike staff tenantContext, this looks up the clinic from the patient record.
 */
export const patientTenantContext = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) throw new UnauthenticatedError();

    // For patient endpoints, the authenticated user's ID IS the patient ID
    const patientId = req.auth.userId;

    // Look up the patient to get their clinic
    const patient = await PatientModel.findById(patientId).lean();
    if (!patient) throw new NotFoundError('Patient');

    const clinic = await ClinicModel.findById(patient.clinicId).lean();
    if (!clinic || !clinic.isActive) {
      throw new UnauthenticatedError('Clinic access is not available.');
    }

    req.tenant = {
      organizationId: patient.organizationId,
      clinicId: patient.clinicId,
      branchId: patient.clinicId, // Patients can access any branch of their clinic
      branchIds: [], // Not applicable for patients
      membershipId: patientId,
      roleKey: 'patient',
      permissions: new Set(), // Patients have no role-based permissions
      timezone: clinic.timezone,
    };
    next();
  },
);

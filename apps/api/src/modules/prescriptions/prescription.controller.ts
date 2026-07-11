import type { Request, Response } from 'express';
import { PERMISSIONS } from '@clinicos/types';
import type { PrescriptionInput } from '@clinicos/validation';
import { computeAge } from '@clinicos/config';
import { ok, created } from '../../shared/http';
import { audit } from '../../shared/audit';
import { ForbiddenError, UnauthenticatedError } from '../../shared/errors';
import { ConsultationModel } from '../consultations/consultation.model';
import { PatientModel } from '../patients/patient.model';
import { StaffProfileModel } from '../staff/staff.model';
import { UserModel } from '../users/user.model';
import { ClinicModel } from '../clinics/clinic.model';
import * as prescriptionService from './prescription.service';
import { buildPrescriptionPdf, type PrescriptionPdfData } from './prescription.pdf';

function requireContext(req: Request): prescriptionService.PrescriptionContext {
  if (!req.auth) throw new UnauthenticatedError();
  if (!req.tenant) throw new UnauthenticatedError();
  return {
    organizationId: req.tenant.organizationId,
    clinicId: req.tenant.clinicId,
    branchId: req.tenant.branchId,
    timezone: req.tenant.timezone,
  };
}

/**
 * POST /prescriptions — autosave-friendly upsert of the draft prescription for a
 * consultation, or (when `finalize: true`) finalizes/revises it. Finalizing requires
 * PRESCRIPTION_SIGN in addition to the route's baseline PRESCRIPTION_CREATE — a doctor
 * can draft without sign rights, but only a signer can commit a finalized version.
 */
export async function save(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const input = req.body as PrescriptionInput;

  if (input.finalize && !req.tenant!.permissions.has(PERMISSIONS.PRESCRIPTION_SIGN)) {
    throw new ForbiddenError('Finalizing a prescription requires the prescription sign permission.');
  }

  const { doc, action } = await prescriptionService.savePrescription(ctx, input);
  const dto = prescriptionService.toPrescriptionDto(doc);

  await audit(req, {
    action: `prescription.${action}`,
    resource: 'prescription',
    resourceId: dto.id,
    after: dto,
  });

  if (action === 'draft_updated') {
    ok(res, dto);
  } else {
    created(res, dto);
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const doc = await prescriptionService.getPrescriptionById(ctx, req.params.id!);
  ok(res, prescriptionService.toPrescriptionDto(doc));
}

export async function getByConsultation(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const { current, history } = await prescriptionService.getByConsultation(ctx, req.params.consultationId!);
  ok(res, {
    current: prescriptionService.toPrescriptionDto(current),
    history: history.map((doc) => prescriptionService.toPrescriptionDto(doc)),
  });
}

/**
 * GET /prescriptions/:id/pdf — looks up the Consultation (for diagnosis, when
 * includeDiagnosis was set), Patient, Doctor (StaffProfile + User) and Clinic to build
 * the header/body data, then streams the rendered PDF back to the client.
 */
export async function downloadPdf(req: Request, res: Response): Promise<void> {
  const ctx = requireContext(req);
  const doc = await prescriptionService.getPrescriptionById(ctx, req.params.id!);

  const [consultation, patient, doctorUser, doctorStaff, clinic] = await Promise.all([
    ConsultationModel.findOne({ _id: doc.consultationId, clinicId: ctx.clinicId, deletedAt: null }).lean(),
    PatientModel.findOne({ _id: doc.patientId, clinicId: ctx.clinicId, deletedAt: null }).lean(),
    UserModel.findById(doc.doctorId).lean(),
    StaffProfileModel.findOne({ userId: doc.doctorId, clinicId: ctx.clinicId }).lean(),
    ClinicModel.findById(ctx.clinicId).lean(),
  ]);

  const data: PrescriptionPdfData = {
    clinicName: clinic?.name ?? 'Clinic',
    clinicPhone: clinic?.phone,
    doctorName: doctorUser?.name ?? 'Doctor',
    doctorQualification: doctorStaff?.qualification ?? undefined,
    doctorRegistrationNumber: doctorStaff?.registrationNumber ?? undefined,
    patientName: patient?.fullName ?? 'Patient',
    patientCode: patient?.code,
    patientAge: computeAge(patient?.dateOfBirth, patient?.approximateAge),
    patientGender: patient?.gender,
    patientMobile: patient?.mobile,
    prescriptionDate: (doc.finalizedAt ?? doc.createdAt).toISOString(),
    diagnosis: doc.includeDiagnosis ? (consultation?.diagnosis ?? []) : undefined,
    items: doc.items,
    advice: doc.advice,
    testsRecommended: doc.testsRecommended,
    followUpAt: doc.followUpAt?.toISOString(),
    verificationCode: doc.verificationCode,
    versionNumber: doc.versionNumber,
    status: doc.status,
  };

  const buffer = await buildPrescriptionPdf(data);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="prescription-${doc._id.toString()}.pdf"`);
  res.send(buffer);
}

import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { computeAge } from '@clinicos/config';
import { ok } from '../../shared/http';
import { UnauthenticatedError, NotFoundError } from '../../shared/errors';
import { parsePagination } from '../../shared/pagination';
import { ConsultationModel } from '../consultations/consultation.model';
import { PatientModel } from '../patients/patient.model';
import { StaffProfileModel } from '../staff/staff.model';
import { UserModel } from '../users/user.model';
import { ClinicModel } from '../clinics/clinic.model';
import { buildPrescriptionPdf, type PrescriptionPdfData } from './prescription.pdf';
import { PrescriptionModel } from './prescription.model';
import { toPrescriptionDto } from './prescription.service';

function requirePatientAuth(req: Request): { patientId: Types.ObjectId } {
  if (!req.auth) throw new UnauthenticatedError();
  // For patient endpoints, the authenticated user's ID IS the patient ID
  return { patientId: req.auth.userId };
}

/**
 * GET /prescriptions/patient/me
 * Retrieve all prescriptions for the authenticated patient with PDF URLs.
 */
export async function listPatientPrescriptions(req: Request, res: Response): Promise<void> {
  const { patientId } = requirePatientAuth(req);
  if (!req.tenant) throw new UnauthenticatedError();

  const pagination = parsePagination(req);

  const [docs, total] = await Promise.all([
    PrescriptionModel.find({
      patientId,
      clinicId: req.tenant.clinicId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    PrescriptionModel.countDocuments({
      patientId,
      clinicId: req.tenant.clinicId,
      deletedAt: null,
    }),
  ]);

  // Add PDF URLs to the prescriptions
  const items = docs.map((doc) => ({
    ...toPrescriptionDto(doc),
    pdfUrl: `/api/v1/prescriptions/${doc._id.toString()}/pdf`,
  }));

  ok(res, items, { page: pagination.page, limit: pagination.limit, total });
}

/**
 * GET /prescriptions/patient/:id
 * Retrieve a single prescription detail for the authenticated patient.
 */
export async function getPatientPrescription(req: Request, res: Response): Promise<void> {
  const { patientId } = requirePatientAuth(req);
  if (!req.tenant) throw new UnauthenticatedError();

  const prescriptionId = req.params.id as string;

  if (!prescriptionId || !Types.ObjectId.isValid(prescriptionId)) {
    throw new NotFoundError('Prescription');
  }

  const doc = await PrescriptionModel.findOne({
    _id: prescriptionId,
    patientId,
    clinicId: req.tenant.clinicId,
    deletedAt: null,
  });

  if (!doc) {
    throw new NotFoundError('Prescription');
  }

  const dto = {
    ...toPrescriptionDto(doc),
    pdfUrl: `/api/v1/prescriptions/${doc._id.toString()}/pdf`,
  };

  ok(res, dto);
}

/**
 * GET /prescriptions/patient/:id/download
 * Stream the rendered PDF for one of the authenticated patient's own prescriptions.
 * Mirrors prescription.controller#downloadPdf but scoped to the caller's own records
 * (patients hold no PRESCRIPTION_READ permission, so they cannot use the staff route).
 */
export async function downloadPatientPrescriptionPdf(req: Request, res: Response): Promise<void> {
  const { patientId } = requirePatientAuth(req);
  if (!req.tenant) throw new UnauthenticatedError();

  const prescriptionId = req.params.id as string;
  if (!prescriptionId || !Types.ObjectId.isValid(prescriptionId)) {
    throw new NotFoundError('Prescription');
  }

  const doc = await PrescriptionModel.findOne({
    _id: prescriptionId,
    patientId,
    clinicId: req.tenant.clinicId,
    deletedAt: null,
  });
  if (!doc) {
    throw new NotFoundError('Prescription');
  }

  const [consultation, patient, doctorUser, doctorStaff, clinic] = await Promise.all([
    ConsultationModel.findOne({ _id: doc.consultationId, clinicId: req.tenant.clinicId, deletedAt: null }).lean(),
    PatientModel.findOne({ _id: doc.patientId, clinicId: req.tenant.clinicId, deletedAt: null }).lean(),
    UserModel.findById(doc.doctorId).lean(),
    StaffProfileModel.findOne({ userId: doc.doctorId, clinicId: req.tenant.clinicId }).lean(),
    ClinicModel.findById(req.tenant.clinicId).lean(),
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

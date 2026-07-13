/**
 * Seeds a ready-to-use demo clinic so you can log in and test the whole app without
 * clicking through onboarding or hand-entering data.
 *
 * Run from the repo root:  npm run seed:demo
 *
 * Creates (idempotently — safe to re-run):
 *   • Owner account (admin@demo.com / Demo1234) via the real `registerOwner` flow
 *   • Marks the clinic ACTIVATED so login goes straight to the dashboard (skips onboarding)
 *   • A doctor account (doctor@demo.com / Doctor1234)
 *   • A handful of patients (staff-created, no portal login)
 *   • A few appointments for today with the doctor
 *   • A patient PORTAL account (patient@demo.com / Patient1234) for apps/patient-web
 *
 * Everything is created through the same models/services the app uses, so the data
 * is identical to what real usage produces.
 */
import { Types } from 'mongoose';
import { ALL_PERMISSIONS } from '@clinicos/types';
import { connectDatabase, disconnectDatabase } from '../database/connection';
import { logger } from '../shared/logger';
import { UserModel } from '../modules/users/user.model';
import { MembershipModel } from '../modules/memberships/membership.model';
import { ClinicModel } from '../modules/clinics/clinic.model';
import { BranchModel } from '../modules/branches/branch.model';
import { registerOwner } from '../modules/auth/auth.service';
import { registerPatient } from '../modules/auth/patient.service';
import { inviteStaff } from '../modules/staff/staff.service';
import { quickRegister } from '../modules/patients/patient.service';
import { PatientModel } from '../modules/patients/patient.model';
import { AppointmentModel } from '../modules/appointments/appointment.model';

const OWNER = { name: 'Demo Admin', email: 'admin@demo.com', password: 'Demo1234', clinicName: 'Demo Clinic' };
const DOCTOR = { name: 'Dr. Asha Rao', email: 'doctor@demo.com', password: 'Doctor1234' };
const PORTAL_PATIENT = {
  name: 'Demo Patient',
  email: 'patient@demo.com',
  phone: '9800000099',
  password: 'Patient1234',
};

const PATIENTS = [
  { fullName: 'Ravi Kumar', gender: 'male' as const, mobile: '9800000001', approximateAge: 34 },
  { fullName: 'Priya Sharma', gender: 'female' as const, mobile: '9800000002', approximateAge: 28 },
  { fullName: 'Imran Sheikh', gender: 'male' as const, mobile: '9800000003', approximateAge: 45 },
  { fullName: 'Sunita Devi', gender: 'female' as const, mobile: '9800000004', approximateAge: 52 },
];

async function main(): Promise<void> {
  await connectDatabase();

  // 1) Owner + org + clinic + branch (idempotent) ---------------------------
  let owner = await UserModel.findOne({ email: OWNER.email.toLowerCase() }).lean();
  if (!owner) {
    await registerOwner({
      name: OWNER.name,
      email: OWNER.email,
      password: OWNER.password,
      clinicName: OWNER.clinicName,
      client: { ip: '127.0.0.1', userAgent: 'seed-demo-script' },
    });
    owner = await UserModel.findOne({ email: OWNER.email.toLowerCase() }).lean();
    logger.info('Owner account created.');
  } else {
    logger.info('Owner account already exists — reusing it.');
  }
  if (!owner) throw new Error('owner not found after seeding');

  const membership = await MembershipModel.findOne({ userId: owner._id, roleKey: 'clinic_owner' }).lean();
  if (!membership) throw new Error('owner membership not found');
  const organizationId = membership.organizationId;
  const clinicId = membership.clinicId;

  const branch = await BranchModel.findOne({ clinicId, isActive: true, deletedAt: null }).lean();
  if (!branch) throw new Error('active branch not found');

  // 2) Skip onboarding — mark the clinic activated --------------------------
  const clinic = await ClinicModel.findById(clinicId);
  if (clinic && !(clinic.onboardingComplete && clinic.isActive)) {
    clinic.onboardingComplete = true;
    clinic.onboardingStep = 9;
    clinic.isActive = true;
    clinic.activatedAt = new Date();
    await clinic.save();
    logger.info('Clinic activated — onboarding skipped.');
  } else {
    logger.info('Clinic already activated.');
  }

  const tenant = {
    organizationId,
    clinicId,
    actorRoleKey: 'clinic_owner' as const,
    actorPermissions: new Set(ALL_PERMISSIONS),
  };

  // 3) Doctor (idempotent) --------------------------------------------------
  const doctorExists = await UserModel.findOne({ email: DOCTOR.email.toLowerCase() }).lean();
  if (!doctorExists) {
    await inviteStaff(tenant, {
      name: DOCTOR.name,
      email: DOCTOR.email,
      roleKey: 'doctor',
      branchIds: [branch._id.toString()],
      specialization: 'General Medicine',
      qualification: 'MBBS, MD',
      registrationNumber: 'REG-DEMO-001',
      consultationFeePaise: 30000, // ₹300
      followUpFeePaise: 15000, // ₹150
      temporaryPassword: DOCTOR.password,
    });
    logger.info('Doctor account created.');
  } else {
    logger.info('Doctor account already exists — skipping.');
  }
  const doctorUser = await UserModel.findOne({ email: DOCTOR.email.toLowerCase() }).lean();
  if (!doctorUser) throw new Error('doctor user not found');

  // 4) Patients (idempotent by count) --------------------------------------
  const patientCount = await PatientModel.countDocuments({ clinicId, deletedAt: null });
  if (patientCount === 0) {
    for (const p of PATIENTS) {
      await quickRegister(tenant, { ...p, isTemporary: false });
    }
    logger.info({ count: PATIENTS.length }, 'Patients created.');
  } else {
    logger.info({ existing: patientCount }, 'Patients already present — skipping.');
  }

  // 5) Appointments for today with the doctor (idempotent) ------------------
  const apptCount = await AppointmentModel.countDocuments({ clinicId, doctorId: doctorUser._id });
  if (apptCount === 0) {
    const patients = await PatientModel.find({ clinicId, deletedAt: null }).limit(3).lean();
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let hour = 10;
    for (const pat of patients) {
      const windowStart = new Date(today);
      windowStart.setHours(hour, 0, 0, 0);
      const windowEnd = new Date(windowStart);
      windowEnd.setMinutes(windowEnd.getMinutes() + 15);
      await AppointmentModel.create({
        organizationId,
        clinicId,
        branchId: branch._id,
        patientId: pat._id,
        doctorId: doctorUser._id,
        date: dateStr,
        windowStart,
        windowEnd,
        type: 'new',
        reason: 'Demo appointment',
        status: 'scheduled',
      });
      hour += 1;
    }
    logger.info({ count: patients.length }, 'Appointments created for today.');
  } else {
    logger.info({ existing: apptCount }, 'Appointments already present — skipping.');
  }

  // 6) Patient portal account (idempotent) -----------------------------------
  const portalUserExists = await UserModel.findOne({ email: PORTAL_PATIENT.email.toLowerCase() }).lean();
  if (!portalUserExists) {
    await registerPatient({
      name: PORTAL_PATIENT.name,
      email: PORTAL_PATIENT.email,
      phone: PORTAL_PATIENT.phone,
      password: PORTAL_PATIENT.password,
      clinicId: clinicId.toString(),
      client: { ip: '127.0.0.1', userAgent: 'seed-demo-script' },
    });
    logger.info('Patient portal account created.');
  } else {
    logger.info('Patient portal account already exists — skipping.');
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n  ✅ Demo data ready!\n` +
      `\n  Owner login (apps/web):\n     Email:    ${OWNER.email}\n     Password: ${OWNER.password}\n` +
      `\n  Doctor login (apps/web):\n     Email:    ${DOCTOR.email}\n     Password: ${DOCTOR.password}\n` +
      `\n  Patient portal login (apps/patient-web):\n     Email:    ${PORTAL_PATIENT.email}\n     Password: ${PORTAL_PATIENT.password}\n` +
      `\n  + ${PATIENTS.length} staff-side patients and today's appointments seeded.\n`,
  );
}

main()
  .catch((err) => {
    logger.fatal({ err }, 'failed to seed demo data');
    process.exitCode = 1;
  })
  .finally(() => void disconnectDatabase());

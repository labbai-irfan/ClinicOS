import { Types } from 'mongoose';
import { logger } from '../logger';
import { connectDb } from '../db';
import { AppointmentModel, PatientModel, ClinicModel, UserModel, StaffProfileModel, MessageLogModel } from '../models';
import { sendSms, sendWhatsApp } from '../twilio';

/**
 * appointment.doctorId may be a staff profile's own _id or the underlying user's _id
 * (whichever form the booking caller used — see schedule.service.ts's expandDoctorIds
 * for the same ambiguity resolved on the API side). Try direct User lookup first (the
 * common case); if that misses, resolve via the staff profile's userId.
 */
async function resolveDoctorName(doctorId: Types.ObjectId): Promise<string | null> {
  const direct = await UserModel.findById(doctorId).lean();
  if (direct) return direct.name;

  const profile = await StaffProfileModel.findById(doctorId).lean();
  if (!profile) return null;
  const user = await UserModel.findById(profile.userId).lean();
  return user?.name ?? null;
}

/** Mirrors apps/api/src/modules/appointments/appointment.service.ts's INACTIVE_STATUSES
 * exactly — the API cancels the queued reminder job on transition into either of these,
 * but this defensive re-check protects against a job that was already in flight when
 * that happened. A denylist here (rather than guessing every valid pre-visit status) so
 * a reminder still fires for any status the API considers "still active". */
const NON_REMINDABLE_STATUSES = new Set(['cancelled', 'no_show']);

function formatLocal(date: Date, timezone: string): { dateLabel: string; timeLabel: string } {
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return { dateLabel, timeLabel };
}

export async function handleAppointmentReminder(payload: { appointmentId: string }): Promise<void> {
  const dbReady = await connectDb();
  if (!dbReady) {
    logger.warn({ appointmentId: payload.appointmentId }, 'no database connection — cannot send reminder');
    return;
  }

  if (!Types.ObjectId.isValid(payload.appointmentId)) {
    logger.warn({ appointmentId: payload.appointmentId }, 'invalid appointmentId — dropping reminder job');
    return;
  }

  const appointment = await AppointmentModel.findById(payload.appointmentId).lean();
  if (!appointment || appointment.deletedAt) {
    logger.info({ appointmentId: payload.appointmentId }, 'appointment no longer exists — skipping reminder');
    return;
  }
  if (NON_REMINDABLE_STATUSES.has(appointment.status)) {
    logger.info(
      { appointmentId: payload.appointmentId, status: appointment.status },
      'appointment status no longer eligible — skipping reminder',
    );
    return;
  }

  const [patient, clinic, doctorName] = await Promise.all([
    PatientModel.findById(appointment.patientId).lean(),
    ClinicModel.findById(appointment.clinicId).lean(),
    resolveDoctorName(appointment.doctorId),
  ]);

  if (!patient || !clinic) {
    logger.warn({ appointmentId: payload.appointmentId }, 'patient or clinic missing — skipping reminder');
    return;
  }

  const logBase = {
    clinicId: appointment.clinicId,
    appointmentId: appointment._id,
    patientId: appointment.patientId,
  };

  if (!patient.mobile) {
    await MessageLogModel.create({
      ...logBase,
      channel: 'sms',
      to: '',
      body: '',
      status: 'skipped',
      error: 'Patient has no mobile number on file',
    });
    logger.info({ appointmentId: payload.appointmentId }, 'patient has no mobile number — reminder skipped');
    return;
  }

  const { dateLabel, timeLabel } = formatLocal(appointment.windowStart, clinic.timezone);
  const doctorLabel = doctorName ? `Dr. ${doctorName}` : 'your doctor';
  const body =
    `Reminder from ${clinic.name}: you have an appointment with ${doctorLabel} on ` +
    `${dateLabel} at ${timeLabel}. Reply STOP to opt out of reminders.`;

  const channel = (process.env.APPOINTMENT_REMINDER_CHANNEL === 'whatsapp' ? 'whatsapp' : 'sms') as
    | 'sms'
    | 'whatsapp';
  const result = channel === 'whatsapp' ? await sendWhatsApp(patient.mobile, body) : await sendSms(patient.mobile, body);

  await MessageLogModel.create({
    ...logBase,
    channel,
    to: patient.mobile,
    body,
    status: result.sent ? 'sent' : 'failed',
    providerMessageId: result.providerMessageId,
    error: result.error,
  });

  if (result.sent) {
    logger.info({ appointmentId: payload.appointmentId, channel }, 'appointment reminder sent');
  } else {
    logger.error({ appointmentId: payload.appointmentId, channel, error: result.error }, 'appointment reminder failed');
  }
}

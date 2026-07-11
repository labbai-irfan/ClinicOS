import { z } from 'zod';
import { localDate, nonEmptyText, objectId, optionalText } from './common';

export const vitalsSchema = z
  .object({
    patientId: objectId,
    queueEntryId: objectId.optional(),
    emergencyCaseId: objectId.optional(),
    temperatureC: z.number().min(25).max(45).optional(),
    systolic: z.number().int().min(40).max(300).optional(),
    diastolic: z.number().int().min(20).max(200).optional(),
    pulseBpm: z.number().int().min(20).max(300).optional(),
    spo2Percent: z.number().min(40).max(100).optional(),
    respiratoryRate: z.number().int().min(4).max(80).optional(),
    heightCm: z.number().min(20).max(272).optional(),
    weightKg: z.number().min(0.4).max(500).optional(),
    bloodGlucoseMgDl: z.number().min(10).max(1000).optional(),
  })
  .refine(
    (v) =>
      [
        v.temperatureC,
        v.systolic,
        v.pulseBpm,
        v.spo2Percent,
        v.respiratoryRate,
        v.heightCm,
        v.weightKg,
        v.bloodGlucoseMgDl,
      ].some((x) => x !== undefined),
    { message: 'Record at least one vital sign', path: ['temperatureC'] },
  );
export type VitalsInput = z.infer<typeof vitalsSchema>;

export const nurseAssessmentSchema = z.object({
  queueEntryId: objectId,
  patientId: objectId,
  chiefComplaint: nonEmptyText(500),
  symptoms: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  durationText: optionalText(120),
  painLevel: z.number().int().min(0).max(10).optional(),
  relevantHistory: optionalText(2000),
  allergies: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  conditions: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  currentMedicines: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  previousTreatment: optionalText(2000),
  nurseNotes: optionalText(4000),
  complete: z.boolean().default(false),
});
export type NurseAssessmentInput = z.infer<typeof nurseAssessmentSchema>;

export const consultationSchema = z.object({
  patientId: objectId,
  queueEntryId: objectId.optional(),
  symptoms: optionalText(4000),
  examinationFindings: optionalText(4000),
  clinicalNotes: optionalText(8000),
  diagnosis: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  treatmentPlan: optionalText(4000),
  advice: optionalText(2000),
  testsOrdered: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  followUpDate: localDate.optional(),
  complete: z.boolean().default(false),
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

export const amendConsultationSchema = z.object({
  reason: nonEmptyText(500),
  changes: z.record(z.unknown()),
});

const prescriptionItem = z.object({
  medicineName: nonEmptyText(200),
  genericName: optionalText(200),
  form: optionalText(60),
  strength: optionalText(60),
  dose: nonEmptyText(60),
  route: optionalText(60),
  frequency: nonEmptyText(80),
  durationDays: z.number().int().min(1).max(365).optional(),
  timing: optionalText(120),
  foodRelation: z.enum(['before_food', 'after_food', 'with_food', 'any']).optional(),
  instruction: optionalText(300),
});

export const prescriptionSchema = z.object({
  consultationId: objectId,
  items: z.array(prescriptionItem).min(1, 'Add at least one medicine').max(30),
  advice: optionalText(2000),
  testsRecommended: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
  followUpDate: localDate.optional(),
  includeDiagnosis: z.boolean().default(false),
  finalize: z.boolean().default(false),
});
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

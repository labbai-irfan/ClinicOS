import { z } from 'zod';
import { GENDERS } from '@clinicos/types';
import { localDate, mobileNumber, nonEmptyText, objectId, optionalText } from './common';

const emergencyContact = z.object({
  name: nonEmptyText(120),
  relation: optionalText(60),
  phone: mobileNumber,
});

/** Quick registration — optimized for reception speed. Phone and DOB are optional. */
export const quickRegisterPatientSchema = z
  .object({
    fullName: nonEmptyText(160),
    gender: z.enum(GENDERS),
    dateOfBirth: localDate.optional(),
    approximateAge: z.number().int().min(0).max(130).optional(),
    mobile: mobileNumber.optional(),
    reasonForVisit: optionalText(300),
    isTemporary: z.boolean().default(false),
  })
  .refine((v) => v.dateOfBirth || v.approximateAge !== undefined || v.isTemporary, {
    message: 'Provide date of birth or approximate age',
    path: ['approximateAge'],
  });
export type QuickRegisterPatientInput = z.infer<typeof quickRegisterPatientSchema>;

export const updatePatientSchema = z.object({
  fullName: nonEmptyText(160).optional(),
  gender: z.enum(GENDERS).optional(),
  dateOfBirth: localDate.optional(),
  approximateAge: z.number().int().min(0).max(130).optional(),
  mobile: mobileNumber.optional(),
  alternateContact: mobileNumber.optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  addressLine: optionalText(300),
  city: optionalText(80),
  preferredLanguage: optionalText(40),
  emergencyContacts: z.array(emergencyContact).max(5).optional(),
  allergies: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  conditions: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  currentMedicines: z.array(z.string().trim().min(1).max(160)).max(100).optional(),
  notes: optionalText(2000),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const patientSearchQuery = z.object({
  q: z.string().trim().max(120).optional(),
  mobile: z.string().trim().max(20).optional(),
  code: z.string().trim().max(30).optional(),
  dateOfBirth: localDate.optional(),
});

export const mergePatientsSchema = z.object({
  primaryId: objectId,
  duplicateId: objectId,
  reason: nonEmptyText(500),
});

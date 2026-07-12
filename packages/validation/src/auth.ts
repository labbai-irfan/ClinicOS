import { z } from 'zod';
import { nonEmptyText } from './common';

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: nonEmptyText(500),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: passwordSchema,
});

export const registerOwnerSchema = z.object({
  name: nonEmptyText(120),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  clinicName: nonEmptyText(160),
});
export type RegisterOwnerInput = z.infer<typeof registerOwnerSchema>;

export const registerPatientSchema = z.object({
  name: nonEmptyText(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,15}$/, 'Enter a valid phone number').optional().or(z.literal('').transform(() => undefined)),
  password: passwordSchema,
});
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

export const loginPatientSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginPatientInput = z.infer<typeof loginPatientSchema>;

export const refreshPatientSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshPatientInput = z.infer<typeof refreshPatientSchema>;

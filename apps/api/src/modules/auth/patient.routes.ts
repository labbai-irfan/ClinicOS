import { Router } from 'express';
import {
  registerPatientSchema,
  loginPatientSchema,
  refreshPatientSchema,
} from '@clinicos/validation';
import { authRateLimit, validate } from '../../middleware';
import * as controller from './patient.controller';

export const patientAuthRoutes = Router();

patientAuthRoutes.post(
  '/register-patient',
  authRateLimit,
  validate(registerPatientSchema),
  controller.registerPatient,
);

patientAuthRoutes.post(
  '/login-patient',
  authRateLimit,
  validate(loginPatientSchema),
  controller.loginPatient,
);

patientAuthRoutes.post(
  '/refresh-patient',
  validate(refreshPatientSchema),
  controller.refreshPatient,
);

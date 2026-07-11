import type { Request, Response } from 'express';
import { created, ok } from '../../shared/http';
import type { AmendConsultationInput } from './consultation.service';
import * as consultationService from './consultation.service';

export async function start(req: Request, res: Response): Promise<void> {
  const dto = await consultationService.startOrUpdateDraft(req);
  created(res, dto);
}

export async function amend(req: Request, res: Response): Promise<void> {
  const input = req.body as AmendConsultationInput;
  const dto = await consultationService.amendConsultation(req, req.params.id!, input);
  ok(res, dto);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const dto = await consultationService.getConsultationById(req, req.params.id!);
  ok(res, dto);
}

export async function listByPatient(req: Request, res: Response): Promise<void> {
  const items = await consultationService.listByPatientId(req, req.params.patientId!);
  ok(res, items);
}

export async function listAmendments(req: Request, res: Response): Promise<void> {
  const items = await consultationService.listAmendments(req, req.params.id!);
  ok(res, items);
}

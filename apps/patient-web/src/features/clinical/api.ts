import { useEffect } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type {
  ApiSuccess,
  ConsultationDto,
  NurseAssessmentDto,
  PatientDto,
  PrescriptionDto,
  QueueEntryDto,
  QueueStatus,
  VitalRecordDto,
} from '@clinicos/types';
import { SOCKET_EVENTS } from '@clinicos/types';
import type {
  ConsultationInput,
  NurseAssessmentInput,
  PrescriptionInput,
  VitalsInput,
} from '@clinicos/validation';
import { amendConsultationSchema } from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';
import { onSocketEvent } from '../../lib/realtime';
import { sortQueueEntries } from './utils';

export type AmendConsultationInput = z.infer<typeof amendConsultationSchema>;

/** Max the shared `paginationQuery` schema allows — used to fetch "the whole day" in one page. */
const QUEUE_LIST_LIMIT = 100;

const NURSE_WORKLIST_STATUSES: readonly QueueStatus[] = ['waiting_for_nurse', 'nurse_assessment'];
const DOCTOR_WORKLIST_STATUSES: readonly QueueStatus[] = [
  'ready_for_doctor',
  'waiting_for_doctor',
  'in_consultation',
];

const NURSE_WORKLIST_KEY = ['clinical', 'nurse-worklist'] as const;
const DOCTOR_WORKLIST_KEY = ['clinical', 'doctor-worklist'] as const;
const queueEntryKey = (queueEntryId: string | undefined) => ['clinical', 'queue-entry', queueEntryId] as const;
const assessmentKey = (queueEntryId: string | undefined) => ['clinical', 'assessment', queueEntryId] as const;
const vitalsKey = (filter: VitalsFilter) =>
  ['clinical', 'vitals', filter.patientId, filter.queueEntryId, filter.emergencyCaseId] as const;
const consultationsByPatientKey = (patientId: string | undefined) =>
  ['clinical', 'consultations', patientId] as const;
const prescriptionKey = (consultationId: string | undefined) => ['clinical', 'prescription', consultationId] as const;
const patientSummaryKey = (patientId: string | undefined) => ['clinical', 'patient', patientId] as const;

async function fetchQueueEntriesByStatus(status: QueueStatus): Promise<QueueEntryDto[]> {
  const { data } = await apiClient.get<ApiSuccess<QueueEntryDto[]>>('/queues', {
    params: { view: 'list', status, limit: QUEUE_LIST_LIMIT },
  });
  return data.data;
}

async function fetchQueueEntriesForToday(): Promise<QueueEntryDto[]> {
  const { data } = await apiClient.get<ApiSuccess<QueueEntryDto[]>>('/queues', {
    params: { view: 'list', limit: QUEUE_LIST_LIMIT },
  });
  return data.data;
}

/** Subscribes for the lifetime of the component, invalidating `queryKey` on any queue socket event. */
function useQueueRealtimeInvalidation(queryKey: readonly unknown[]): void {
  const queryClient = useQueryClient();
  const keyToken = JSON.stringify(queryKey);
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey });
    const unsubscribers = [
      onSocketEvent(SOCKET_EVENTS.QUEUE_UPDATED, invalidate),
      onSocketEvent(SOCKET_EVENTS.QUEUE_ENTRY_CHANGED, invalidate),
    ];
    return () => unsubscribers.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyToken is the stable identity of queryKey
  }, [queryClient, keyToken]);
}

/** Nurse worklist: patients checked in and waiting, plus assessments already in progress. */
export function useNurseWorklistQuery() {
  useQueueRealtimeInvalidation(NURSE_WORKLIST_KEY);
  return useQuery({
    queryKey: NURSE_WORKLIST_KEY,
    queryFn: async () => {
      const lists = await Promise.all(NURSE_WORKLIST_STATUSES.map(fetchQueueEntriesByStatus));
      return lists.flat().sort(sortQueueEntries);
    },
    refetchInterval: 30_000,
  });
}

/** Doctor worklist: patients ready/waiting for the doctor, plus consultations already in progress. */
export function useDoctorWorklistQuery() {
  useQueueRealtimeInvalidation(DOCTOR_WORKLIST_KEY);
  return useQuery({
    queryKey: DOCTOR_WORKLIST_KEY,
    queryFn: async () => {
      const lists = await Promise.all(DOCTOR_WORKLIST_STATUSES.map(fetchQueueEntriesByStatus));
      return lists.flat().sort(sortQueueEntries);
    },
    refetchInterval: 30_000,
  });
}

/**
 * A single queue entry by id (there is no dedicated `GET /queues/:id`) — looked up from
 * today's full list. Scoped to "today" like the rest of the live queue.
 */
export function useQueueEntryQuery(queueEntryId: string | undefined) {
  useQueueRealtimeInvalidation(queueEntryKey(queueEntryId));
  return useQuery({
    queryKey: queueEntryKey(queueEntryId),
    queryFn: async () => {
      const entries = await fetchQueueEntriesForToday();
      return entries.find((entry) => entry.id === queueEntryId) ?? null;
    },
    enabled: !!queueEntryId,
  });
}

export interface TransitionQueueInput {
  id: string;
  to: QueueStatus;
  reason?: string;
  expectedVersion?: number;
}

export function useTransitionQueueMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TransitionQueueInput) => {
      const { data } = await apiClient.patch<ApiSuccess<QueueEntryDto>>(`/queues/${id}/transition`, body);
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(queueEntryKey(dto.id), dto);
      void queryClient.invalidateQueries({ queryKey: NURSE_WORKLIST_KEY });
      void queryClient.invalidateQueries({ queryKey: DOCTOR_WORKLIST_KEY });
    },
  });
}

/** `null` means "no draft/completed assessment started yet for this queue entry". */
export function useAssessmentQuery(queueEntryId: string | undefined) {
  return useQuery({
    queryKey: assessmentKey(queueEntryId),
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<ApiSuccess<NurseAssessmentDto>>(
          `/nurse-assessments/by-queue-entry/${queueEntryId}`,
        );
        return data.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!queueEntryId,
  });
}

export function useSaveAssessmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NurseAssessmentInput) => {
      const { data } = await apiClient.post<ApiSuccess<NurseAssessmentDto>>('/nurse-assessments', input);
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData(assessmentKey(dto.queueEntryId), dto);
    },
  });
}

export interface VitalsFilter {
  patientId?: string;
  queueEntryId?: string;
  emergencyCaseId?: string;
}

export function useVitalsQuery(filter: VitalsFilter) {
  return useQuery({
    queryKey: vitalsKey(filter),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<VitalRecordDto[]>>('/vitals', { params: filter });
      return data.data;
    },
    enabled: Boolean(filter.patientId || filter.queueEntryId || filter.emergencyCaseId),
  });
}

export function useSaveVitalsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VitalsInput) => {
      const { data } = await apiClient.post<ApiSuccess<VitalRecordDto>>('/vitals', input);
      return data.data;
    },
    // Vitals have no update endpoint (every save creates a new record) — invalidate every
    // cached vitals query (by patient, by queue entry, ...) rather than trying to patch one.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clinical', 'vitals'] });
    },
  });
}

function consultationsByPatientQueryOptions(patientId: string | undefined) {
  return {
    queryKey: consultationsByPatientKey(patientId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<ConsultationDto[]>>(`/consultations/by-patient/${patientId}`);
      return data.data;
    },
    enabled: !!patientId,
  } as const;
}

/** Full consultation history for a patient (right-hand history panel, spec §22). */
export function usePatientConsultationsQuery(patientId: string | undefined) {
  return useQuery(consultationsByPatientQueryOptions(patientId));
}

/**
 * The consultation tied to one queue entry — there is no dedicated `by-queue-entry`
 * endpoint, so this shares the by-patient list's cache entry and selects from it.
 * `null` means "no draft/completed consultation started yet for this visit".
 */
export function useConsultationQuery(queueEntryId: string | undefined, patientId: string | undefined) {
  return useQuery({
    ...consultationsByPatientQueryOptions(patientId),
    enabled: !!patientId && !!queueEntryId,
    select: (list) => list.find((c) => c.queueEntryId === queueEntryId) ?? null,
  });
}

function upsertConsultationInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  dto: ConsultationDto,
): void {
  queryClient.setQueryData<ConsultationDto[]>(consultationsByPatientKey(dto.patientId), (old) => {
    const list = old ? [...old] : [];
    const index = list.findIndex((c) => c.id === dto.id);
    if (index >= 0) list[index] = dto;
    else list.unshift(dto);
    return list;
  });
}

export function useSaveConsultationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ConsultationInput) => {
      const { data } = await apiClient.post<ApiSuccess<ConsultationDto>>('/consultations', input);
      return data.data;
    },
    onSuccess: (dto) => {
      upsertConsultationInCache(queryClient, dto);
      void queryClient.invalidateQueries({ queryKey: DOCTOR_WORKLIST_KEY });
    },
  });
}

/** Amends a finalized ('completed') consultation — the only way to change it after completion. */
export function useAmendConsultationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: AmendConsultationInput }) => {
      const { data } = await apiClient.patch<ApiSuccess<ConsultationDto>>(`/consultations/${id}/amend`, input);
      return data.data;
    },
    onSuccess: (dto) => upsertConsultationInCache(queryClient, dto),
  });
}

export interface PrescriptionBundle {
  current: PrescriptionDto | null;
  history: PrescriptionDto[];
}

/** `current` is `null` until the doctor saves a first draft for this consultation. */
export function usePrescriptionQuery(consultationId: string | undefined) {
  return useQuery({
    queryKey: prescriptionKey(consultationId),
    queryFn: async (): Promise<PrescriptionBundle> => {
      try {
        const { data } = await apiClient.get<ApiSuccess<{ current: PrescriptionDto; history: PrescriptionDto[] }>>(
          `/prescriptions/by-consultation/${consultationId}`,
        );
        return data.data;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return { current: null, history: [] };
        }
        throw err;
      }
    },
    enabled: !!consultationId,
  });
}

export function useSavePrescriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PrescriptionInput) => {
      const { data } = await apiClient.post<ApiSuccess<PrescriptionDto>>('/prescriptions', input);
      return data.data;
    },
    onSuccess: (dto) => {
      queryClient.setQueryData<PrescriptionBundle>(prescriptionKey(dto.consultationId), (old) => ({
        current: dto,
        history: old?.history ?? [],
      }));
    },
  });
}

/** Downloads the prescription PDF as an authenticated request and opens it in a new tab. */
export async function openPrescriptionPdf(prescriptionId: string): Promise<void> {
  const response = await apiClient.get<Blob>(`/prescriptions/${prescriptionId}/pdf`, {
    responseType: 'blob',
  });
  const blobUrl = URL.createObjectURL(response.data);
  window.open(blobUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Minimal patient read kept local to this feature — see `features/patients/api.ts` for the full profile hook. */
export function usePatientSummaryQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: patientSummaryKey(patientId),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<PatientDto>>(`/patients/${patientId}`);
      return data.data;
    },
    enabled: !!patientId,
  });
}

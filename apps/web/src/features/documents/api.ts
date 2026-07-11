import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { type AxiosProgressEvent } from 'axios';
import type { ApiSuccess, DocumentDto } from '@clinicos/types';
import { apiClient } from '../../lib/api-client';

const DOCUMENTS_KEY = 'documents' as const;

const documentsKey = (patientId: string) => [DOCUMENTS_KEY, patientId] as const;

/** GET /documents?patientId= — returns both active and archived versions; the page splits them. */
export function useDocumentsQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: documentsKey(patientId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<DocumentDto[]>>('/documents', {
        params: { patientId },
      });
      return data.data;
    },
    enabled: !!patientId,
  });
}

function toUploadProgressHandler(onUploadProgress?: (percent: number) => void) {
  if (!onUploadProgress) return undefined;
  return (event: AxiosProgressEvent) => {
    if (!event.total) return;
    onUploadProgress(Math.round((event.loaded / event.total) * 100));
  };
}

export interface UploadDocumentVariables {
  /** Must already contain the `file`, `patientId`, `category`, and `title` fields. */
  formData: FormData;
  onUploadProgress?: (percent: number) => void;
}

/** POST /documents — multipart upload. FormData is passed as-is so axios sets the boundary header itself. */
export function useUploadDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ formData, onUploadProgress }: UploadDocumentVariables) => {
      const { data } = await apiClient.post<ApiSuccess<DocumentDto>>('/documents', formData, {
        onUploadProgress: toUploadProgressHandler(onUploadProgress),
      });
      return data.data;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: documentsKey(doc.patientId) });
    },
  });
}

export interface ReplaceDocumentVariables {
  id: string;
  /** Must already contain the `file`, `patientId`, `category`, and `title` fields. */
  formData: FormData;
  onUploadProgress?: (percent: number) => void;
}

/** POST /documents/:id/replace — new version row; the previous version is archived, never deleted. */
export function useReplaceDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData, onUploadProgress }: ReplaceDocumentVariables) => {
      const { data } = await apiClient.post<ApiSuccess<DocumentDto>>(`/documents/${id}/replace`, formData, {
        onUploadProgress: toUploadProgressHandler(onUploadProgress),
      });
      return data.data;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: documentsKey(doc.patientId) });
    },
  });
}

/** PATCH /documents/:id/archive — documents are never hard-deleted. */
export function useArchiveDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<ApiSuccess<DocumentDto>>(`/documents/${id}/archive`);
      return data.data;
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: documentsKey(doc.patientId) });
    },
  });
}

/**
 * Absolute URL for `GET /documents/:id/download`. The endpoint itself is a 302 redirect to a
 * short-lived signed storage URL — link straight to it (new tab) rather than fetching + blobbing.
 */
export function getDocumentDownloadUrl(id: string): string {
  return apiClient.getUri({ url: `/documents/${id}/download` });
}

/** True when an upload/replace failed because document storage (Cloudinary) isn't configured yet. */
export function isDocumentStorageUnavailable(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 503;
}

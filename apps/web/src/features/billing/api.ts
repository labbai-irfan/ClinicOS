import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import type { ApiSuccess, InvoiceDto, InvoiceStatus, PaymentDto, PaymentMethod } from '@clinicos/types';
import { refundSchema, type CreateInvoiceInput, type RecordPaymentInput } from '@clinicos/validation';
import { apiClient } from '../../lib/api-client';

/** `GET /billing/invoices/:id` shape: the shared `InvoiceDto` plus its payment history. */
export interface InvoiceDetailDto extends InvoiceDto {
  payments: PaymentDto[];
}

export interface InvoiceListParams {
  status?: InvoiceStatus;
  patientId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceListResult {
  items: InvoiceDto[];
  page: number;
  limit: number;
  total: number;
}

/** Mirrors `apps/api/src/modules/billing/billing.service.ts` `DailyClosingResult` — no
 *  shared DTO exists for this report yet, so it is kept local to this feature (same
 *  pattern as `onboarding/api.ts` and `patients/api.ts`). */
export interface DailyClosingMethodSummary {
  method: PaymentMethod;
  totalPaise: number;
  paymentCount: number;
  invoiceCount: number;
}

export interface DailyClosingResult {
  date: string;
  totalPaise: number;
  paymentCount: number;
  invoiceCount: number;
  byMethod: DailyClosingMethodSummary[];
}

export type RefundInput = z.infer<typeof refundSchema>;

const BILLING_KEY = 'billing' as const;

export function useInvoicesQuery(params: InvoiceListParams) {
  return useQuery({
    queryKey: [BILLING_KEY, 'invoices', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<InvoiceDto[]>>('/billing/invoices', { params });
      return {
        items: data.data,
        page: data.meta.page ?? params.page ?? 1,
        limit: data.meta.limit ?? params.limit ?? data.data.length,
        total: data.meta.total ?? data.data.length,
      } satisfies InvoiceListResult;
    },
    placeholderData: (previous) => previous,
  });
}

export function useInvoiceQuery(invoiceId: string | undefined) {
  return useQuery({
    queryKey: [BILLING_KEY, 'invoice', invoiceId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<InvoiceDetailDto>>(`/billing/invoices/${invoiceId}`);
      return data.data;
    },
    enabled: !!invoiceId,
    retry: false,
  });
}

/**
 * Creates an invoice. `idempotencyKey` must be generated once when the "New Invoice"
 * form opens and reused for every retry of that same submission (matching the
 * backend's `idempotent()` middleware) so a network retry never creates two invoices.
 */
export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      idempotencyKey,
    }: {
      input: CreateInvoiceInput;
      idempotencyKey: string;
    }) => {
      const { data } = await apiClient.post<ApiSuccess<InvoiceDto>>('/billing/invoices', input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return data.data;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: [BILLING_KEY, 'invoices'] });
      queryClient.setQueryData<InvoiceDetailDto>([BILLING_KEY, 'invoice', invoice.id], {
        ...invoice,
        payments: [],
      });
    },
  });
}

/**
 * Records up to four payments against an invoice in one batch. `idempotencyKey` must
 * be generated once when the "Record Payment" form opens and reused for retries of
 * that same submission — this is the single most important idempotency point in the
 * app (a retried request must never double-charge a patient).
 */
export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId,
      input,
      idempotencyKey,
    }: {
      invoiceId: string;
      input: RecordPaymentInput;
      idempotencyKey: string;
    }) => {
      const { data } = await apiClient.post<ApiSuccess<InvoiceDetailDto>>(
        `/billing/invoices/${invoiceId}/payments`,
        input,
        { headers: { 'Idempotency-Key': idempotencyKey } },
      );
      return data.data;
    },
    onSuccess: (invoice, variables) => {
      queryClient.setQueryData([BILLING_KEY, 'invoice', variables.invoiceId], invoice);
      queryClient.invalidateQueries({ queryKey: [BILLING_KEY, 'invoices'] });
    },
  });
}

export function useRefundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RefundInput) => {
      const { data } = await apiClient.post<ApiSuccess<{ payment: PaymentDto; invoice: InvoiceDto }>>(
        `/billing/payments/${input.paymentId}/refund`,
        input,
      );
      return data.data;
    },
    onSuccess: ({ invoice, payment }) => {
      queryClient.setQueryData<InvoiceDetailDto | undefined>(
        [BILLING_KEY, 'invoice', invoice.id],
        (previous) =>
          previous
            ? {
                ...previous,
                ...invoice,
                payments: previous.payments.map((p) => (p.id === payment.id ? payment : p)),
              }
            : previous,
      );
      queryClient.invalidateQueries({ queryKey: [BILLING_KEY, 'invoices'] });
    },
  });
}

export function useDailyClosingQuery(date: string) {
  return useQuery({
    queryKey: [BILLING_KEY, 'daily-closing', date],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiSuccess<DailyClosingResult>>('/billing/daily-closing', {
        params: { date },
      });
      return data.data;
    },
  });
}

/** Fetches a PDF as an authenticated blob (the endpoint requires the Bearer header, so
 *  a plain `window.open(url)` would 401) and opens it in a new tab. */
async function openPdfInNewTab(url: string): Promise<void> {
  const response = await apiClient.get<Blob>(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(response.data);
  const win = window.open(blobUrl, '_blank', 'noopener');
  if (!win) {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.rel = 'noopener';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function useInvoicePdfMutation() {
  return useMutation({
    mutationFn: (invoiceId: string) => openPdfInNewTab(`/billing/invoices/${invoiceId}/pdf`),
  });
}

export function useReceiptPdfMutation() {
  return useMutation({
    mutationFn: (paymentId: string) => openPdfInNewTab(`/billing/payments/${paymentId}/receipt-pdf`),
  });
}

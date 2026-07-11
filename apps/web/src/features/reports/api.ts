import { useQuery } from '@tanstack/react-query';
import type { ApiSuccess, EmergencyPriority, PaymentMethod, QueueStatus } from '@clinicos/types';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';

/** Inclusive date-only range, transmitted as ISO `yyyy-MM-dd` strings (spec §40). */
export interface AnalyticsDateRange {
  startDate: string;
  endDate: string;
}

// ---------------------------------------------------------------------------
// Patient analytics
// ---------------------------------------------------------------------------

export interface PatientAnalyticsPoint {
  date: string;
  newPatients: number;
  returningPatients: number;
}

export interface PatientAnalyticsDto {
  series: PatientAnalyticsPoint[];
}

// ---------------------------------------------------------------------------
// Queue analytics
// ---------------------------------------------------------------------------

export interface QueueWaitPoint {
  date: string;
  avgWaitMinutes: number | null;
}

export interface QueueStatusCount {
  status: QueueStatus;
  count: number;
}

export interface QueueAnalyticsDto {
  waitTimeSeries: QueueWaitPoint[];
  statusDistribution: QueueStatusCount[];
}

// ---------------------------------------------------------------------------
// Revenue analytics
// ---------------------------------------------------------------------------

export interface RevenuePoint {
  date: string;
  revenuePaise: number;
}

export interface RevenueByMethod {
  method: PaymentMethod;
  amountPaise: number;
}

export interface RevenueAnalyticsDto {
  dailyRevenue: RevenuePoint[];
  byPaymentMethod: RevenueByMethod[];
}

// ---------------------------------------------------------------------------
// Emergency analytics
// ---------------------------------------------------------------------------

export interface EmergencyVolumePoint {
  date: string;
  count: number;
}

export interface EmergencyPriorityCount {
  priority: EmergencyPriority;
  count: number;
}

export interface EmergencyAnalyticsDto {
  volumeSeries: EmergencyVolumePoint[];
  priorityDistribution: EmergencyPriorityCount[];
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * The analytics endpoints (spec §40) are being built by another agent in a
 * later phase and their exact response shape may still be settling. Every
 * array field is read defensively — anything other than an array falls back
 * to `[]` — so a partial/placeholder backend response still renders as an
 * empty chart instead of throwing and taking the whole tab down.
 */
function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

async function fetchAnalytics(path: string, range: AnalyticsDateRange): Promise<Record<string, unknown>> {
  const { data } = await apiClient.get<ApiSuccess<Record<string, unknown>>>(path, {
    params: { startDate: range.startDate, endDate: range.endDate },
  });
  return (data.data ?? {}) as Record<string, unknown>;
}

/** Common query tuning: an unimplemented/404 endpoint should fail fast, not hammer the API. */
const ANALYTICS_QUERY_OPTS = {
  retry: 1,
  retryDelay: 1000,
  refetchOnWindowFocus: false,
  staleTime: 60_000,
} as const;

export function useAnalyticsQueryKey(scope: string, range: AnalyticsDateRange) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  return ['reports', scope, activeBranchId ?? 'all', range.startDate, range.endDate] as const;
}

export function usePatientAnalyticsQuery(range: AnalyticsDateRange) {
  const queryKey = useAnalyticsQueryKey('patients', range);
  return useQuery({
    queryKey,
    queryFn: async (): Promise<PatientAnalyticsDto> => {
      const raw = await fetchAnalytics('/analytics/patients', range);
      return { series: toArray<PatientAnalyticsPoint>(raw.series) };
    },
    ...ANALYTICS_QUERY_OPTS,
  });
}

export function useQueueAnalyticsQuery(range: AnalyticsDateRange) {
  const queryKey = useAnalyticsQueryKey('queue', range);
  return useQuery({
    queryKey,
    queryFn: async (): Promise<QueueAnalyticsDto> => {
      const raw = await fetchAnalytics('/analytics/queue', range);
      return {
        waitTimeSeries: toArray<QueueWaitPoint>(raw.waitTimeSeries),
        statusDistribution: toArray<QueueStatusCount>(raw.statusDistribution),
      };
    },
    ...ANALYTICS_QUERY_OPTS,
  });
}

export function useRevenueAnalyticsQuery(range: AnalyticsDateRange) {
  const queryKey = useAnalyticsQueryKey('revenue', range);
  return useQuery({
    queryKey,
    queryFn: async (): Promise<RevenueAnalyticsDto> => {
      const raw = await fetchAnalytics('/analytics/revenue', range);
      return {
        dailyRevenue: toArray<RevenuePoint>(raw.dailyRevenue),
        byPaymentMethod: toArray<RevenueByMethod>(raw.byPaymentMethod),
      };
    },
    ...ANALYTICS_QUERY_OPTS,
  });
}

export function useEmergencyAnalyticsQuery(range: AnalyticsDateRange) {
  const queryKey = useAnalyticsQueryKey('emergencies', range);
  return useQuery({
    queryKey,
    queryFn: async (): Promise<EmergencyAnalyticsDto> => {
      const raw = await fetchAnalytics('/analytics/emergencies', range);
      return {
        volumeSeries: toArray<EmergencyVolumePoint>(raw.volumeSeries),
        priorityDistribution: toArray<EmergencyPriorityCount>(raw.priorityDistribution),
      };
    },
    ...ANALYTICS_QUERY_OPTS,
  });
}

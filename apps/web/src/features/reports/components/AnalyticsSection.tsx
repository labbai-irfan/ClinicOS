import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';

interface AnalyticsSectionProps<T> {
  isLoading: boolean;
  isError: boolean;
  data: T | undefined;
  /** Returns true when the query succeeded but there is nothing to chart for the selected range. */
  isEmpty: (data: T) => boolean;
  height?: number;
  children: (data: T) => ReactNode;
}

/**
 * Loading/error/empty wiring for a single analytics chart (spec §40). This is
 * deliberately not `<QueryBoundary>`: the analytics endpoints are being built
 * by another agent in a later phase, so a failed or missing response here is
 * an expected, temporary condition rather than a user-facing error — it
 * renders the same calm "not available yet" empty state instead of an
 * alarming `ErrorState`. A successful call that returns no rows gets its own
 * distinct message so "not built yet" is never confused with "nothing
 * happened this period".
 */
export function AnalyticsSection<T>({ isLoading, isError, data, isEmpty, height = 280, children }: AnalyticsSectionProps<T>) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading analytics" style={{ height }}>
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (isError || data === undefined) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Analytics data will appear here once available"
        description="This report isn't connected yet. Check back once the analytics service is live."
      />
    );
  }

  if (isEmpty(data)) {
    return (
      <EmptyState icon={BarChart3} title="No data for this period" description="Try a different date range." />
    );
  }

  return <>{children(data)}</>;
}

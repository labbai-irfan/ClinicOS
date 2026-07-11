import type { ReactNode } from 'react';
import { SkeletonRows } from './ui/Skeleton';
import { ErrorState } from './ui/ErrorState';
import { EmptyState } from './ui/EmptyState';

interface QueryBoundaryProps<T> {
  isLoading: boolean;
  isError: boolean;
  data: T | undefined;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  loadingFallback?: ReactNode;
  children: (data: T) => ReactNode;
}

/**
 * Standard loading/error/empty wiring for a TanStack Query result (spec §34).
 * Every list/detail page should route its query through this instead of
 * hand-rolling `if (isLoading) ...` branches.
 */
export function QueryBoundary<T>({
  isLoading,
  isError,
  data,
  onRetry,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  loadingFallback,
  children,
}: QueryBoundaryProps<T>) {
  if (isLoading) return <>{loadingFallback ?? <SkeletonRows />}</>;
  if (isError) return <ErrorState onRetry={onRetry} />;
  if (data === undefined) return <ErrorState onRetry={onRetry} />;
  if (isEmpty?.(data)) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children(data)}</>;
}

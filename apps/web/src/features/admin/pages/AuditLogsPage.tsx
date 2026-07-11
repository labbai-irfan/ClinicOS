import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ScrollText, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { DEFAULTS } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useAuditLogsQuery } from '../api';

function formatTimestamp(value: string): string {
  try {
    return format(parseISO(value), 'dd MMM yyyy, HH:mm:ss');
  } catch {
    return value;
  }
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = DEFAULTS.PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [action, resource, resourceId, dateFrom, dateTo]);

  const { data, isLoading, isError, refetch } = useAuditLogsQuery({
    action: action.trim() || undefined,
    resource: resource.trim() || undefined,
    resourceId: resourceId.trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters = Boolean(action.trim() || resource.trim() || resourceId.trim() || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Read-only record of sensitive actions across the clinic. Audit records cannot be edited."
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Action (e.g. role.permissions_update)"
          aria-label="Filter by action"
        />
        <Input
          value={resource}
          onChange={(e) => setResource(e.target.value)}
          placeholder="Resource (e.g. staff)"
          aria-label="Filter by resource"
        />
        <Input
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          placeholder="Resource ID"
          aria-label="Filter by resource ID"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="audit-from" className="text-sm text-text-secondary">
            From
          </label>
          <Input id="audit-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="audit-to" className="text-sm text-text-secondary">
            To
          </label>
          <Input id="audit-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAction('');
                setResource('');
                setResourceId('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => void refetch()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle={hasFilters ? 'No audit records match your filters' : 'No audit records yet'}
        emptyDescription={hasFilters ? 'Try a different action, resource, or date range.' : undefined}
      >
        {(result) => (
          <>
            {/* Desktop table */}
            <Card className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Resource</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{log.userName ?? 'System'}</p>
                        {log.roleKey && <p className="text-xs text-text-secondary">{log.roleKey}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-primary">{log.action}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {log.resource}
                        {log.resourceId && (
                          <span className="ml-1 font-mono text-xs text-text-secondary">
                            ({log.resourceId})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{log.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile stacked cards */}
            <div className="space-y-3 md:hidden">
              {result.items.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">{log.userName ?? 'System'}</p>
                      <p className="text-xs text-text-secondary">{formatTimestamp(log.createdAt)}</p>
                    </div>
                    <ScrollText className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                  </div>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-text-secondary">Action</dt>
                      <dd className="font-mono text-xs text-text-primary">{log.action}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-secondary">Resource</dt>
                      <dd className="text-text-primary">
                        {log.resource}
                        {log.resourceId && <span className="ml-1 font-mono text-xs">({log.resourceId})</span>}
                      </dd>
                    </div>
                    {log.reason && (
                      <div>
                        <dt className="text-xs text-text-secondary">Reason</dt>
                        <dd className="text-text-primary">{log.reason}</dd>
                      </div>
                    )}
                    {log.roleKey && (
                      <div>
                        <dt className="text-xs text-text-secondary">Role</dt>
                        <dd className="text-text-primary">{log.roleKey}</dd>
                      </div>
                    )}
                  </dl>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {result.total} record{result.total === 1 ? '' : 's'} · Page {result.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

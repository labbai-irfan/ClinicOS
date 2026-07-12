import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { INVOICE_STATUSES, PERMISSIONS, type InvoiceStatus } from '@clinicos/types';
import { DEFAULTS, formatMoney } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { StatusPill } from '../../../components/ui/StatusPill';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { useInvoicesQuery } from '../api';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE } from '../billing-labels';
import { NewInvoiceDialog } from '../components/NewInvoiceDialog';

type StatusFilter = InvoiceStatus | 'all';

export default function InvoiceListPage() {
  const { has } = usePermission();
  const canCreate = has(PERMISSIONS.BILLING_CREATE);

  const [status, setStatus] = useState<StatusFilter>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [patientId, setPatientId] = useState('');
  const [page, setPage] = useState(1);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const limit = DEFAULTS.PAGE_SIZE;

  const hasFilters = status !== 'all' || !!from || !!to || !!patientId;

  useEffect(() => {
    setPage(1);
  }, [status, from, to, patientId]);

  const { data, isLoading, isError, refetch } = useInvoicesQuery({
    status: status === 'all' ? undefined : status,
    from: from || undefined,
    to: to || undefined,
    patientId: patientId.trim() || undefined,
    page,
    limit,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create and track patient invoices and payments."
        actions={
          canCreate ? (
            <Button onClick={() => setNewInvoiceOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Invoice
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Status" htmlFor="filter-status">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger id="filter-status" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {INVOICE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {INVOICE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="From" htmlFor="filter-from">
          <Input
            id="filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </Field>
        <Field label="To" htmlFor="filter-to">
          <Input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </Field>
        <Field label="Patient ID" htmlFor="filter-patient">
          <Input
            id="filter-patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Paste a patient ID"
            className="w-56"
          />
        </Field>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus('all');
              setFrom('');
              setTo('');
              setPatientId('');
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => refetch()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle={hasFilters ? 'No invoices match your filters' : 'No invoices yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different status, date range, or patient.'
            : canCreate
              ? 'Create the first invoice to get started.'
              : undefined
        }
      >
        {(result) => (
          <>
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-3 font-medium text-text-primary">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {invoice.patientName ?? invoice.patientId}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {format(new Date(invoice.createdAt), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-text-primary">{formatMoney(invoice.totalPaise)}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{formatMoney(invoice.paidPaise)}</td>
                      <td className="px-4 py-3">
                        <StatusPill
                          label={INVOICE_STATUS_LABELS[invoice.status]}
                          tone={INVOICE_STATUS_TONE[invoice.status]}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/billing/${invoice.id}`} className="text-sm text-primary hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {result.total} invoice{result.total === 1 ? '' : 's'} &middot; Page {result.page} of {totalPages}
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

      <NewInvoiceDialog open={newInvoiceOpen} onClose={() => setNewInvoiceOpen(false)} />
    </div>
  );
}

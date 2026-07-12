import { useState } from 'react';
import { format } from 'date-fns';
import { Printer, Receipt, Wallet } from 'lucide-react';
import { formatMoney } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { useDailyClosingQuery } from '../api';
import { PAYMENT_METHOD_LABELS } from '../billing-labels';

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4 print:border-black print:shadow-none sm:p-5">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-primary/10 p-2 text-primary print:hidden">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
          <p className="text-xl font-semibold text-text-primary">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export default function DailyClosingPage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const { data, isLoading, isError, refetch } = useDailyClosingQuery(date);

  return (
    <div>
      <PageHeader
        title="Daily Closing"
        description="End-of-day collection summary by payment method."
        actions={
          <div className="flex items-end gap-2 print:hidden">
            <Field label="Date" htmlFor="closing-date">
              <Input id="closing-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Button type="button" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </Button>
          </div>
        }
      />

      <p className="mb-4 hidden text-sm text-text-secondary print:block">
        {format(new Date(`${date}T00:00:00`), 'EEEE, d MMMM yyyy')}
      </p>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => refetch()}
        isEmpty={(d) => d.paymentCount === 0}
        emptyTitle="No payments recorded"
        emptyDescription={`No payments were collected on ${date}.`}
      >
        {(closing) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryTile icon={Wallet} label="Total collected" value={formatMoney(closing.totalPaise)} />
              <SummaryTile icon={Receipt} label="Payments" value={String(closing.paymentCount)} />
              <SummaryTile icon={Receipt} label="Invoices" value={String(closing.invoiceCount)} />
            </div>

            <Card className="print:border-black print:shadow-none">
              <CardHeader>
                <CardTitle>Breakdown by payment method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                        <th className="py-2">Method</th>
                        <th className="py-2 text-right">Amount</th>
                        <th className="py-2 text-right">Payments</th>
                        <th className="py-2 text-right">Invoices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closing.byMethod.map((m) => (
                        <tr key={m.method} className="border-b border-border last:border-0">
                          <td className="py-2 text-text-primary">{PAYMENT_METHOD_LABELS[m.method]}</td>
                          <td className="py-2 text-right text-text-primary">{formatMoney(m.totalPaise)}</td>
                          <td className="py-2 text-right text-text-secondary">{m.paymentCount}</td>
                          <td className="py-2 text-right text-text-secondary">{m.invoiceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

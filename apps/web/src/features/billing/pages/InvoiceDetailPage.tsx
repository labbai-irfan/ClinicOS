import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Printer, Undo2 } from 'lucide-react';
import { PERMISSIONS, type PaymentDto } from '@clinicos/types';
import { formatMoney } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { EmptyState } from '../../../components/ui/EmptyState';
import { IconButton } from '../../../components/ui/Tooltip';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { usePermission } from '../../../hooks/use-permission';
import { useInvoicePdfMutation, useInvoiceQuery, useReceiptPdfMutation } from '../api';
import { BILLING_ITEM_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE, PAYMENT_METHOD_LABELS } from '../billing-labels';
import { RecordPaymentDialog } from '../components/RecordPaymentDialog';
import { RefundDialog } from '../components/RefundDialog';

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { has } = usePermission();
  const canRecordPayment = has(PERMISSIONS.BILLING_CREATE);
  const canRefund = has(PERMISSIONS.BILLING_REFUND);

  const { data: invoice, isLoading, isError, refetch } = useInvoiceQuery(invoiceId);
  const invoicePdf = useInvoicePdfMutation();
  const receiptPdf = useReceiptPdfMutation();

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<PaymentDto | null>(null);

  return (
    <div>
      <PageHeader
        title={invoice ? invoice.invoiceNumber : 'Invoice'}
        description={invoice ? `Created ${format(new Date(invoice.createdAt), 'dd MMM yyyy, h:mm a')}` : undefined}
        actions={
          invoice && (
            <Button
              variant="outline"
              size="sm"
              loading={invoicePdf.isPending}
              onClick={() => invoicePdf.mutate(invoice.id)}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print invoice
            </Button>
          )
        }
      />

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={invoice}
        onRetry={() => refetch()}
      >
        {(inv) => {
          const duePaise = Math.max(0, inv.totalPaise - inv.paidPaise);
          return (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-4 sm:p-5 lg:col-span-2">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-text-primary">Items</h2>
                    <StatusPill label={INVOICE_STATUS_LABELS[inv.status]} tone={INVOICE_STATUS_TONE[inv.status]} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                          <th className="py-2">Description</th>
                          <th className="py-2">Type</th>
                          <th className="py-2 text-right">Qty</th>
                          <th className="py-2 text-right">Unit price</th>
                          <th className="py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items.map((item, index) => (
                          <tr key={index} className="border-b border-border last:border-0">
                            <td className="py-2 text-text-primary">{item.description}</td>
                            <td className="py-2 text-text-secondary">{BILLING_ITEM_TYPE_LABELS[item.type]}</td>
                            <td className="py-2 text-right text-text-secondary">{item.quantity}</td>
                            <td className="py-2 text-right text-text-secondary">
                              {formatMoney(item.unitPricePaise)}
                            </td>
                            <td className="py-2 text-right text-text-primary">{formatMoney(item.totalPaise)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-text-secondary">
                    Patient: {inv.patientName ?? <span className="font-mono">{inv.patientId}</span>}
                    {inv.deferred && ' · Deferred billing'}
                  </p>
                </Card>

                <Card className="space-y-2 p-4 text-sm sm:p-5">
                  <h2 className="mb-1 text-base font-semibold text-text-primary">Summary</h2>
                  <div className="flex justify-between text-text-secondary">
                    <span>Subtotal</span>
                    <span>{formatMoney(inv.subtotalPaise)}</span>
                  </div>
                  {inv.discountPaise > 0 && (
                    <div className="flex justify-between text-danger">
                      <span>Discount{inv.discountReason ? ` (${inv.discountReason})` : ''}</span>
                      <span>-{formatMoney(inv.discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-text-primary">
                    <span>Total</span>
                    <span>{formatMoney(inv.totalPaise)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>Paid</span>
                    <span>{formatMoney(inv.paidPaise)}</span>
                  </div>
                  {inv.refundedPaise > 0 && (
                    <div className="flex justify-between text-info">
                      <span>Refunded</span>
                      <span>{formatMoney(inv.refundedPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-text-primary">
                    <span>Amount due</span>
                    <span>{formatMoney(duePaise)}</span>
                  </div>

                  {canRecordPayment && duePaise > 0 && (
                    <Button className="w-full" onClick={() => setPaymentDialogOpen(true)}>
                      Record payment
                    </Button>
                  )}
                </Card>
              </div>

              <Card className="p-4 sm:p-5">
                <h2 className="mb-3 text-base font-semibold text-text-primary">Payment history</h2>
                {inv.payments.length === 0 ? (
                  <EmptyState title="No payments recorded yet" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-text-secondary">
                          <th className="py-2">Receipt</th>
                          <th className="py-2">Method</th>
                          <th className="py-2 text-right">Amount</th>
                          <th className="py-2">Reference</th>
                          <th className="py-2">Received by</th>
                          <th className="py-2">Date</th>
                          <th className="py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {inv.payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-border last:border-0">
                            <td className="py-2 text-text-primary">{payment.receiptNumber}</td>
                            <td className="py-2 text-text-secondary">{PAYMENT_METHOD_LABELS[payment.method]}</td>
                            <td className="py-2 text-right text-text-primary">{formatMoney(payment.amountPaise)}</td>
                            <td className="py-2 text-text-secondary">{payment.reference ?? '—'}</td>
                            <td className="py-2 text-text-secondary">{payment.receivedByName ?? '—'}</td>
                            <td className="py-2 text-text-secondary">
                              {format(new Date(payment.createdAt), 'dd MMM yyyy, h:mm a')}
                            </td>
                            <td className="py-2">
                              <div className="flex items-center justify-end gap-1">
                                {payment.refunded && <StatusPill label="Refunded" tone="info" className="mr-1" />}
                                <IconButton
                                  label="Print receipt"
                                  icon={Printer}
                                  onClick={() => receiptPdf.mutate(payment.id)}
                                  disabled={receiptPdf.isPending}
                                />
                                {canRefund && !payment.refunded && (
                                  <IconButton
                                    label="Refund payment"
                                    icon={Undo2}
                                    onClick={() => setRefundPayment(payment)}
                                  />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <RecordPaymentDialog
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                invoiceId={inv.id}
                duePaise={duePaise}
              />
              <RefundDialog open={!!refundPayment} onClose={() => setRefundPayment(null)} payment={refundPayment} />
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

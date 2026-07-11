import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PaymentDto } from '@clinicos/types';
import { refundSchema } from '@clinicos/validation';
import { formatMoney } from '@clinicos/config';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useRefundMutation, type RefundInput } from '../api';

// Local form-only schema: money is entered in rupees here and converted to integer
// paise on submit; the final payload is re-validated against the shared
// `refundSchema` from @clinicos/validation before it is sent.
const refundFormSchema = z.object({
  amountRupees: z.coerce.number().min(0.01, 'Must be greater than 0'),
  reason: z.string().trim().min(1, 'A reason is required').max(500),
});
type RefundFormValues = z.infer<typeof refundFormSchema>;

function defaultValuesFor(payment: PaymentDto | null): RefundFormValues {
  return { amountRupees: payment ? Math.max(0, payment.amountPaise) / 100 : 0, reason: '' };
}

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  payment: PaymentDto | null;
}

/** Refunds part or all of a previously recorded payment. Gated by BILLING_REFUND at
 *  the call site; always requires a reason (spec §24). */
export function RefundDialog({ open, onClose, payment }: RefundDialogProps) {
  const refund = useRefundMutation();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RefundFormValues>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: defaultValuesFor(payment),
  });

  useEffect(() => {
    if (open) reset(defaultValuesFor(payment));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset identity is stable
  }, [open, payment]);

  const close = () => {
    reset(defaultValuesFor(payment));
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!payment) return;
    try {
      const input: RefundInput = refundSchema.parse({
        paymentId: payment.id,
        amountPaise: Math.round(values.amountRupees * 100),
        reason: values.reason,
      });
      await refund.mutateAsync(input);
      toast.success('Refund recorded', `${formatMoney(input.amountPaise)} refunded from receipt ${payment.receiptNumber}.`);
      close();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not process the refund.') });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && payment && (
        <DialogContent
          title="Refund payment"
          description={`Receipt ${payment.receiptNumber} · Paid ${formatMoney(payment.amountPaise)}`}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Refund amount (₹)" htmlFor="refund-amount" required error={errors.amountRupees?.message}>
              <Input
                id="refund-amount"
                type="number"
                min={0.01}
                step="0.01"
                invalid={!!errors.amountRupees}
                {...register('amountRupees')}
              />
            </Field>
            <Field label="Reason" htmlFor="refund-reason" required error={errors.reason?.message}>
              <Textarea id="refund-reason" invalid={!!errors.reason} {...register('reason')} />
            </Field>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={isSubmitting || refund.isPending}>
                Refund payment
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

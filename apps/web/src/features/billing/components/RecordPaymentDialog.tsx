import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { PAYMENT_METHODS } from '@clinicos/types';
import { recordPaymentSchema, type RecordPaymentInput } from '@clinicos/validation';
import { formatMoney } from '@clinicos/config';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { IconButton } from '../../../components/ui/Tooltip';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { useRecordPaymentMutation } from '../api';
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../billing-labels';

const MAX_ROWS = 4;

// Local form-only schema: money is entered in rupees here and converted to integer
// paise on submit; the final payload is re-validated against the shared
// `recordPaymentSchema` from @clinicos/validation before it is sent.
const paymentRowSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amountRupees: z.coerce.number().min(0.01, 'Must be greater than 0'),
  reference: z.string().trim().max(120).optional(),
});

const paymentFormSchema = z.object({
  rows: z.array(paymentRowSchema).min(1).max(MAX_ROWS),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

function toRupees(paise: number): number {
  return Math.max(0, Math.round(paise) / 100);
}

function defaultValuesFor(duePaise: number): PaymentFormValues {
  return { rows: [{ method: 'cash', amountRupees: toRupees(duePaise), reference: '' }] };
}

function remainingRupees(rows: { amountRupees: number }[], duePaise: number): number {
  const allocatedPaise = rows.reduce((sum, row) => sum + Math.round((row.amountRupees || 0) * 100), 0);
  return toRupees(duePaise - allocatedPaise);
}

interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  duePaise: number;
}

export function RecordPaymentDialog({ open, onClose, invoiceId, duePaise }: RecordPaymentDialogProps) {
  const recordPayment = useRecordPaymentMutation();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: defaultValuesFor(duePaise),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rows' });

  // A fresh key every time the form opens; retries of the same submission (the
  // mutation itself, or the user hitting Submit again after a failure) reuse it.
  // The row defaults (pre-filled to the remaining due amount) are also reset here.
  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      reset(defaultValuesFor(duePaise));
    }
  }, [open, duePaise, reset]);

  const close = () => {
    reset(defaultValuesFor(duePaise));
    onClose();
  };

  const rows = watch('rows');
  const enteredPaise = rows.reduce((sum, row) => sum + Math.round((row.amountRupees || 0) * 100), 0);
  const remainingAfterEntry = duePaise - enteredPaise;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input: RecordPaymentInput = recordPaymentSchema.parse({
        payments: values.rows.map((row) => ({
          method: row.method,
          amountPaise: Math.round(row.amountRupees * 100),
          reference: row.reference?.trim() ? row.reference.trim() : undefined,
        })),
      });
      const invoice = await recordPayment.mutateAsync({ invoiceId, input, idempotencyKey });
      toast.success(
        'Payment recorded',
        `Invoice ${invoice.invoiceNumber} is now ${INVOICE_STATUS_LABELS[invoice.status].toLowerCase()}.`,
      );
      close();
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not record the payment.') });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent
          title="Record payment"
          description={`Amount due: ${formatMoney(duePaise)}`}
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1.2fr_auto]"
                >
                  <Field
                    label="Method"
                    htmlFor={`payment-method-${index}`}
                    required
                    error={errors.rows?.[index]?.method?.message}
                  >
                    <Controller
                      control={control}
                      name={`rows.${index}.method`}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger id={`payment-method-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((method) => (
                              <SelectItem key={method} value={method}>
                                {PAYMENT_METHOD_LABELS[method]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field
                    label="Amount (₹)"
                    htmlFor={`payment-amount-${index}`}
                    required
                    error={errors.rows?.[index]?.amountRupees?.message}
                  >
                    <Input
                      id={`payment-amount-${index}`}
                      type="number"
                      min={0.01}
                      step="0.01"
                      invalid={!!errors.rows?.[index]?.amountRupees}
                      {...register(`rows.${index}.amountRupees`)}
                    />
                  </Field>
                  <Field
                    label="Reference"
                    htmlFor={`payment-reference-${index}`}
                    hint="Optional — UTR, card slip, cheque #"
                    error={errors.rows?.[index]?.reference?.message}
                  >
                    <Input id={`payment-reference-${index}`} {...register(`rows.${index}.reference`)} />
                  </Field>
                  <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                    <IconButton
                      label="Remove payment row"
                      icon={Trash2}
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fields.length >= MAX_ROWS}
                onClick={() =>
                  append({
                    method: 'cash',
                    amountRupees: remainingRupees(rows, duePaise),
                    reference: '',
                  })
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add payment row
              </Button>
            </div>

            <div className="space-y-1 rounded-lg border border-border bg-surface-muted p-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Amount due</span>
                <span>{formatMoney(duePaise)}</span>
              </div>
              <div className="flex justify-between font-semibold text-text-primary">
                <span>Entered</span>
                <span>{formatMoney(enteredPaise)}</span>
              </div>
              {remainingAfterEntry !== 0 && (
                <p className={remainingAfterEntry < 0 ? 'text-danger' : 'text-text-secondary'}>
                  {remainingAfterEntry < 0
                    ? `Exceeds the amount due by ${formatMoney(-remainingAfterEntry)}.`
                    : `${formatMoney(remainingAfterEntry)} will remain due.`}
                </p>
              )}
            </div>

            {errors.root?.message && (
              <p role="alert" className="text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting || recordPayment.isPending}>
                Record payment
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

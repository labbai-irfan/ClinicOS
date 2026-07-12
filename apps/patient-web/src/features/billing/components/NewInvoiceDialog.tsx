import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { BILLING_ITEM_TYPES, PERMISSIONS } from '@clinicos/types';
import { createInvoiceSchema, objectId, type CreateInvoiceInput } from '@clinicos/validation';
import { formatMoney } from '@clinicos/config';
import { Dialog, DialogContent } from '../../../components/ui/Dialog';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Input, Textarea } from '../../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { IconButton } from '../../../components/ui/Tooltip';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { usePermission } from '../../../hooks/use-permission';
import { useCreateInvoiceMutation } from '../api';
import { BILLING_ITEM_TYPE_LABELS } from '../billing-labels';

// Local form-only schema: money is entered in rupees (decimal) here and converted to
// integer paise on submit; the final payload is re-validated against the shared
// `createInvoiceSchema` from @clinicos/validation before it is sent.
const invoiceItemFormSchema = z.object({
  description: z.string().trim().min(1, 'Required').max(240),
  type: z.enum(BILLING_ITEM_TYPES),
  quantity: z.coerce.number().int().min(1, 'Min 1').max(999),
  unitPriceRupees: z.coerce.number().min(0, 'Must be 0 or more'),
});

const invoiceFormSchema = z
  .object({
    patientId: objectId,
    items: z.array(invoiceItemFormSchema).min(1, 'Add at least one item'),
    discountRupees: z.coerce.number().min(0).default(0),
    discountReason: z.string().trim().max(300).optional(),
    deferred: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.discountRupees > 0 && !value.discountReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountReason'],
        message: 'A reason is required once a discount amount is entered.',
      });
    }
  });

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const EMPTY_ITEM: InvoiceFormValues['items'][number] = {
  description: '',
  type: 'consultation',
  quantity: 1,
  unitPriceRupees: 0,
};

const DEFAULT_VALUES: InvoiceFormValues = {
  patientId: '',
  items: [EMPTY_ITEM],
  discountRupees: 0,
  discountReason: undefined,
  deferred: false,
};

function lineTotalPaise(item: { quantity: number; unitPriceRupees: number }): number {
  const unitPricePaise = Math.round((item.unitPriceRupees || 0) * 100);
  return (item.quantity || 0) * unitPricePaise;
}

export function NewInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { has } = usePermission();
  const canDiscount = has(PERMISSIONS.BILLING_DISCOUNT);
  const createInvoice = useCreateInvoiceMutation();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // A fresh key every time the form opens; retries of the same submission (the
  // mutation itself, or the user hitting Submit again after a failure) reuse it.
  useEffect(() => {
    if (open) setIdempotencyKey(crypto.randomUUID());
  }, [open]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const close = () => {
    reset(DEFAULT_VALUES);
    onClose();
  };

  const items = watch('items');
  const discountRupees = watch('discountRupees');
  const subtotalPaise = items.reduce((sum, item) => sum + lineTotalPaise(item), 0);
  const discountPaise = canDiscount ? Math.round((discountRupees || 0) * 100) : 0;
  const totalPaise = Math.max(0, subtotalPaise - discountPaise);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const input: CreateInvoiceInput = createInvoiceSchema.parse({
        patientId: values.patientId,
        items: values.items.map((item) => ({
          description: item.description,
          type: item.type,
          quantity: item.quantity,
          unitPricePaise: Math.round(item.unitPriceRupees * 100),
        })),
        discountPaise,
        discountReason: discountPaise > 0 ? values.discountReason : undefined,
        deferred: values.deferred,
        finalize: true,
      });
      const invoice = await createInvoice.mutateAsync({ input, idempotencyKey });
      toast.success('Invoice created', `Invoice ${invoice.invoiceNumber} has been created.`);
      close();
      navigate(`/billing/${invoice.id}`);
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not create the invoice.') });
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      {open && (
        <DialogContent title="New invoice" description="Add line items to bill a patient.">
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field
              label="Patient ID"
              htmlFor="invoice-patientId"
              required
              hint="Paste the patient's record ID from their profile."
              error={errors.patientId?.message}
            >
              <Input id="invoice-patientId" invalid={!!errors.patientId} {...register('patientId')} />
            </Field>

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-primary">Line items</p>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[2fr_1.4fr_70px_1fr_auto]"
                >
                  <div className="col-span-2 sm:col-span-1">
                    <Field
                      label="Description"
                      htmlFor={`item-desc-${index}`}
                      required
                      error={errors.items?.[index]?.description?.message}
                    >
                      <Input
                        id={`item-desc-${index}`}
                        invalid={!!errors.items?.[index]?.description}
                        {...register(`items.${index}.description`)}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Type"
                    htmlFor={`item-type-${index}`}
                    required
                    error={errors.items?.[index]?.type?.message}
                  >
                    <Controller
                      control={control}
                      name={`items.${index}.type`}
                      render={({ field: selectField }) => (
                        <Select value={selectField.value} onValueChange={selectField.onChange}>
                          <SelectTrigger id={`item-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_ITEM_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {BILLING_ITEM_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field
                    label="Qty"
                    htmlFor={`item-qty-${index}`}
                    required
                    error={errors.items?.[index]?.quantity?.message}
                  >
                    <Input
                      id={`item-qty-${index}`}
                      type="number"
                      min={1}
                      step={1}
                      invalid={!!errors.items?.[index]?.quantity}
                      {...register(`items.${index}.quantity`)}
                    />
                  </Field>
                  <Field
                    label="Unit price (₹)"
                    htmlFor={`item-price-${index}`}
                    required
                    error={errors.items?.[index]?.unitPriceRupees?.message}
                  >
                    <Input
                      id={`item-price-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      invalid={!!errors.items?.[index]?.unitPriceRupees}
                      {...register(`items.${index}.unitPriceRupees`)}
                    />
                  </Field>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:justify-between">
                    <span className="text-sm font-medium text-text-primary">
                      {formatMoney(lineTotalPaise(items[index] ?? EMPTY_ITEM))}
                    </span>
                    <IconButton
                      label="Remove item"
                      icon={Trash2}
                      type="button"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    />
                  </div>
                </div>
              ))}
              {typeof errors.items?.message === 'string' && (
                <p role="alert" className="text-sm text-danger">
                  {errors.items.message}
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_ITEM)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add item
              </Button>
            </div>

            <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border accent-primary"
                {...register('deferred')}
              />
              Defer billing (leave unpaid without collecting payment now)
            </label>

            {canDiscount && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Discount (₹)" htmlFor="discount-rupees" error={errors.discountRupees?.message}>
                  <Input
                    id="discount-rupees"
                    type="number"
                    min={0}
                    step="0.01"
                    invalid={!!errors.discountRupees}
                    {...register('discountRupees')}
                  />
                </Field>
                <Field
                  label="Discount reason"
                  htmlFor="discount-reason"
                  required={discountRupees > 0}
                  hint={discountRupees > 0 ? undefined : 'Required once a discount amount is entered'}
                  error={errors.discountReason?.message}
                >
                  <Textarea
                    id="discount-reason"
                    invalid={!!errors.discountReason}
                    {...register('discountReason')}
                  />
                </Field>
              </div>
            )}

            <div className="space-y-1 rounded-lg border border-border bg-surface-muted p-3 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span>{formatMoney(subtotalPaise)}</span>
              </div>
              {discountPaise > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Discount</span>
                  <span>-{formatMoney(discountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-semibold text-text-primary">
                <span>Total</span>
                <span>{formatMoney(totalPaise)}</span>
              </div>
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
              <Button type="submit" loading={isSubmitting || createInvoice.isPending}>
                Create invoice
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

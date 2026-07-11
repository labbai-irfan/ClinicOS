import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { Field } from '../../../../components/ui/Field';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { apiErrorMessage } from '../../../../lib/api-client';
import { addressContactSchema, type AddressContactInput } from '../../schemas';
import { useUpdateBranchMutation } from '../../api';
import { StepFooter } from '../StepFooter';

interface AddressContactStepProps {
  branchId: string | null;
  onBack: () => void;
  onComplete: (patch: { address: AddressContactInput }) => void;
}

export function AddressContactStep({ branchId, onBack, onComplete }: AddressContactStepProps) {
  const updateBranch = useUpdateBranchMutation();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressContactInput>({ resolver: zodResolver(addressContactSchema) });

  if (!branchId) {
    return (
      <div className="p-4 sm:p-5">
        <ErrorState
          title="No branch found"
          description="Your clinic's default branch could not be found. Please sign out and sign in again, or contact support."
        />
      </div>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateBranch.mutateAsync({ branchId, input: values });
      onComplete({ address: values });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not save the branch address.') });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <CardHeader>
        <div>
          <CardTitle>Address &amp; contact</CardTitle>
          <CardDescription>Where patients will find this branch.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Branch name" htmlFor="branch-name" required error={errors.name?.message}>
          <Input id="branch-name" invalid={!!errors.name} {...register('name')} placeholder="Main branch" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address line 1" htmlFor="branch-address1" error={errors.addressLine1?.message}>
            <Input id="branch-address1" {...register('addressLine1')} />
          </Field>
          <Field label="Address line 2" htmlFor="branch-address2" error={errors.addressLine2?.message}>
            <Input id="branch-address2" {...register('addressLine2')} />
          </Field>
          <Field label="City" htmlFor="branch-city" error={errors.city?.message}>
            <Input id="branch-city" {...register('city')} />
          </Field>
          <Field label="State" htmlFor="branch-state" error={errors.state?.message}>
            <Input id="branch-state" {...register('state')} />
          </Field>
          <Field label="Postal code" htmlFor="branch-postal" error={errors.postalCode?.message}>
            <Input id="branch-postal" {...register('postalCode')} />
          </Field>
          <Field label="Phone" htmlFor="branch-phone" error={errors.phone?.message}>
            <Input id="branch-phone" invalid={!!errors.phone} {...register('phone')} />
          </Field>
        </div>

        {errors.root?.message && (
          <p role="alert" className="text-sm text-danger">
            {errors.root.message}
          </p>
        )}
      </CardContent>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <StepFooter onBack={onBack} loading={isSubmitting || updateBranch.isPending} />
      </div>
    </form>
  );
}

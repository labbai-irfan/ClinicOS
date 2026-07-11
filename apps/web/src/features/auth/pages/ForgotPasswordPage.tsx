import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@clinicos/validation';
import type { z } from 'zod';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { useForgotPasswordMutation } from '../api';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await forgotPassword.mutateAsync(values.email);
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-xl font-semibold text-text-primary">Reset your password</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Enter your account email and we'll issue reset instructions.
        </p>

        {forgotPassword.isSuccess ? (
          <p className="rounded border border-success/30 bg-success/10 p-3 text-sm text-success">
            If that account exists, reset instructions have been issued.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email" required error={errors.email?.message}>
              <Input id="email" type="email" invalid={!!errors.email} {...register('email')} />
            </Field>
            <Button type="submit" className="w-full" loading={isSubmitting || forgotPassword.isPending}>
              Send reset instructions
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

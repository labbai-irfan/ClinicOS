import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema, type ResetPasswordInput } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { apiErrorMessage } from '../../../lib/api-client';
import { useResetPasswordMutation } from '../api';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetPassword = useResetPasswordMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: searchParams.get('token') ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync(values);
      navigate('/login', { replace: true });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'This reset link is invalid or has expired.') });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold text-text-primary">Set a new password</h1>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <input type="hidden" {...register('token')} />
          <Field
            label="New password"
            htmlFor="password"
            required
            hint="At least 8 characters, with uppercase, lowercase and a number"
            error={errors.password?.message}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-danger">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting || resetPassword.isPending}>
            Reset password
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

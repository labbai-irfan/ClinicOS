import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { loginSchema, type LoginInput } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { apiErrorMessage } from '../../../lib/api-client';
import { useLoginMutation } from '../api';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLoginMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Incorrect email or password.') });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Stethoscope className="h-9 w-9 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-text-primary">Sign in to ClinicOS</h1>
          <p className="text-sm text-text-secondary">Enter your clinic account details</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field label="Password" htmlFor="password" required error={errors.password?.message}>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-danger">
              {errors.root.message}
            </p>
          )}

          <Button type="submit" className="w-full" loading={isSubmitting || login.isPending}>
            Sign in
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-primary hover:underline">
            Register a clinic
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { registerPatientSchema, type RegisterPatientInput } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { apiErrorMessage } from '../../../lib/api-client-patient';
import { useRegisterPatientMutation } from '../api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerPatient = useRegisterPatientMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterPatientInput>({ resolver: zodResolver(registerPatientSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerPatient.mutateAsync(values);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not create your account.') });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Stethoscope className="h-9 w-9 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-text-primary">Create Account</h1>
          <p className="text-sm text-text-secondary">Sign up to book appointments and manage your health</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Your name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" autoComplete="name" invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={!!errors.email}
              {...register('email')}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 (555) 000-0000"
              invalid={!!errors.phone}
              {...register('phone')}
            />
          </Field>
          <Field
            label="Password"
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

          <Button type="submit" className="w-full" loading={isSubmitting || registerPatient.isPending}>
            Create Account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

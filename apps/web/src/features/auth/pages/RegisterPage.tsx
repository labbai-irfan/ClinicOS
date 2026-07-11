import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { registerOwnerSchema, type RegisterOwnerInput } from '@clinicos/validation';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Field } from '../../../components/ui/Field';
import { apiErrorMessage } from '../../../lib/api-client';
import { useRegisterOwnerMutation } from '../api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const registerOwner = useRegisterOwnerMutation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterOwnerInput>({ resolver: zodResolver(registerOwnerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerOwner.mutateAsync(values);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError('root', { message: apiErrorMessage(err, 'Could not create your clinic account.') });
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Stethoscope className="h-9 w-9 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-text-primary">Register your clinic</h1>
          <p className="text-sm text-text-secondary">Create the clinic owner account to get started</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Your name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" autoComplete="name" invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="Clinic name" htmlFor="clinicName" required error={errors.clinicName?.message}>
            <Input id="clinicName" invalid={!!errors.clinicName} {...register('clinicName')} />
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

          <Button type="submit" className="w-full" loading={isSubmitting || registerOwner.isPending}>
            Create clinic account
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

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, LogOut, Pencil, Save, X } from 'lucide-react';
import { z } from 'zod';
import { Button, Card, Field, Input, PageHeader } from '../../../components/ui';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client-patient';
import { usePatientAuthStore } from '../../../stores/auth-store-patient';
import { usePatientMeQuery, useUpdatePatientMutation } from '../api';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

type ProfileInput = z.infer<typeof profileSchema>;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/\d/, 'Include a number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export default function PatientProfilePage() {
  const navigate = useNavigate();
  const patientQuery = usePatientMeQuery();
  const updatePatient = useUpdatePatientMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleSignOut = () => {
    usePatientAuthStore.getState().logout();
    navigate('/login', { replace: true });
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    values: {
      name: patientQuery.data?.fullName || '',
      email: patientQuery.data?.email || '',
      phone: patientQuery.data?.mobile || '',
      dateOfBirth: patientQuery.data?.dateOfBirth || '',
      gender: patientQuery.data?.gender as any || '',
      address: patientQuery.data?.addressLine || '',
      city: patientQuery.data?.city || '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onProfileSubmit = handleSubmit(async (values) => {
    try {
      await updatePatient.mutateAsync(values);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      toast.error('Failed to update profile', apiErrorMessage(err));
    }
  });

  const onPasswordSubmit = handlePasswordSubmit(async (values) => {
    try {
      // TODO: Call change password API
      console.log('Change password:', values);
      toast.success('Password changed successfully');
      resetPassword();
      setShowChangePassword(false);
    } catch (err) {
      toast.error('Failed to change password', apiErrorMessage(err));
    }
  });

  if (patientQuery.isLoading) {
    return <ProfileSkeleton />;
  }

  if (patientQuery.isError || !patientQuery.data) {
    return <ErrorState onRetry={() => patientQuery.refetch()} />;
  }

  const patient = patientQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information"
      />

      <form onSubmit={onProfileSubmit} className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Personal Information</h2>
            {!isEditing && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Full Name"
                htmlFor="name"
                required
                error={profileErrors.name?.message}
              >
                <Input
                  id="name"
                  {...register('name')}
                  disabled={!isEditing}
                />
              </Field>
              <Field
                label="Email"
                htmlFor="email"
                required
                error={profileErrors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={!isEditing}
                />
              </Field>
              <Field
                label="Phone"
                htmlFor="phone"
                error={profileErrors.phone?.message}
              >
                <Input
                  id="phone"
                  type="tel"
                  {...register('phone')}
                  disabled={!isEditing}
                />
              </Field>
              <Field
                label="Date of Birth"
                htmlFor="dateOfBirth"
                error={profileErrors.dateOfBirth?.message}
              >
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register('dateOfBirth')}
                  disabled={!isEditing}
                />
              </Field>
              <Field
                label="Gender"
                htmlFor="gender"
                error={profileErrors.gender?.message}
              >
                <select
                  id="gender"
                  {...register('gender')}
                  disabled={!isEditing}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field
                label="City"
                htmlFor="city"
                error={profileErrors.city?.message}
              >
                <Input
                  id="city"
                  {...register('city')}
                  disabled={!isEditing}
                />
              </Field>
            </div>

            <div>
              <label className="text-sm font-medium text-text-primary">
                Address
              </label>
              <textarea
                {...register('address')}
                disabled={!isEditing}
                rows={3}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-medium text-text-primary">Emergency Contact</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Name"
                  htmlFor="emergencyContactName"
                  error={profileErrors.emergencyContactName?.message}
                >
                  <Input
                    id="emergencyContactName"
                    {...register('emergencyContactName')}
                    disabled={!isEditing}
                  />
                </Field>
                <Field
                  label="Phone"
                  htmlFor="emergencyContactPhone"
                  error={profileErrors.emergencyContactPhone?.message}
                >
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    {...register('emergencyContactPhone')}
                    disabled={!isEditing}
                  />
                </Field>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button type="submit" loading={isProfileSubmitting}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    reset();
                  }}
                  disabled={isProfileSubmitting}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Card>
      </form>

      <Card className="p-6">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-muted p-4 hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-text-secondary" aria-hidden="true" />
              <div className="text-left">
                <p className="font-medium text-text-primary">Change Password</p>
                <p className="text-sm text-text-secondary">Update your account password</p>
              </div>
            </div>
          </button>

          {showChangePassword && (
            <form onSubmit={onPasswordSubmit} className="space-y-4 border-t border-border pt-4">
              <Field
                label="Current Password"
                htmlFor="currentPassword"
                required
                error={passwordErrors.currentPassword?.message}
              >
                <Input
                  id="currentPassword"
                  type="password"
                  {...registerPassword('currentPassword')}
                />
              </Field>
              <Field
                label="New Password"
                htmlFor="newPassword"
                required
                hint="At least 8 characters with uppercase, lowercase, and a number"
                error={passwordErrors.newPassword?.message}
              >
                <Input
                  id="newPassword"
                  type="password"
                  {...registerPassword('newPassword')}
                />
              </Field>
              <Field
                label="Confirm Password"
                htmlFor="confirmPassword"
                required
                error={passwordErrors.confirmPassword?.message}
              >
                <Input
                  id="confirmPassword"
                  type="password"
                  {...registerPassword('confirmPassword')}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" loading={isPasswordSubmitting}>
                  Save Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(false);
                    resetPassword();
                  }}
                  disabled={isPasswordSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>

      <Card className="border-danger/20 bg-danger/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-text-primary">Sign Out</h3>
            <p className="text-sm text-text-secondary">End your current session</p>
          </div>
          <Button variant="outline" className="border-danger text-danger" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-32" />
      <Card className="p-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

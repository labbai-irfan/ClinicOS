import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PERMISSIONS } from '@clinicos/types';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { PermissionDenied } from '../../../components/ui/PermissionDenied';
import { ErrorState } from '../../../components/ui/ErrorState';
import { SkeletonRows } from '../../../components/ui/Skeleton';
import { toast } from '../../../components/ui/Toast';
import { usePermission } from '../../../hooks/use-permission';
import { useAuthStore } from '../../../stores/auth-store';
import { apiErrorMessage } from '../../../lib/api-client';
import { useAdvanceOnboardingStepMutation, useClinicQuery, type ClinicRecord } from '../api';
import { TOTAL_ONBOARDING_STEPS } from '../steps-meta';
import type { WizardSummary } from '../wizard-types';
import { StepRail } from '../components/StepRail';
import { ClinicIdentityStep } from '../components/steps/ClinicIdentityStep';
import { AddressContactStep } from '../components/steps/AddressContactStep';
import { WorkingHoursStep } from '../components/steps/WorkingHoursStep';
import { AddDoctorsStep } from '../components/steps/AddDoctorsStep';
import { ConsultationFeeStep } from '../components/steps/ConsultationFeeStep';
import { QueueRulesStep } from '../components/steps/QueueRulesStep';
import { PrescriptionBrandingStep } from '../components/steps/PrescriptionBrandingStep';
import { InviteStaffStep } from '../components/steps/InviteStaffStep';
import { ReviewActivateStep } from '../components/steps/ReviewActivateStep';

function clampStep(step: number): number {
  return Math.min(Math.max(step, 1), TOTAL_ONBOARDING_STEPS);
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { has } = usePermission();
  const branchId = useAuthStore((s) => s.user?.activeBranchId ?? null);

  const clinicQuery = useClinicQuery();
  const advanceStep = useAdvanceOnboardingStepMutation();

  const [currentStep, setCurrentStep] = useState(1);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1);
  const [summary, setSummary] = useState<WizardSummary>({});
  const initialized = useRef(false);

  // Resume where the clinic left off (server is the source of truth for progress),
  // but only once — later refetches (triggered by our own advance-step calls) must
  // not snap the wizard backward while the user is actively moving forward.
  useEffect(() => {
    if (initialized.current || !clinicQuery.data) return;
    initialized.current = true;
    const resumeAt = clampStep(clinicQuery.data.onboardingStep || 1);
    setCurrentStep(resumeAt);
    setMaxUnlockedStep(resumeAt);
  }, [clinicQuery.data]);

  if (!has(PERMISSIONS.ONBOARDING_MANAGE)) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <PermissionDenied message="You do not have permission to set up this clinic." />
      </div>
    );
  }

  if (clinicQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (clinicQuery.isError || !clinicQuery.data) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <ErrorState
          title="Could not load your clinic"
          description={apiErrorMessage(clinicQuery.error, 'Please try again.')}
          onRetry={() => clinicQuery.refetch()}
        />
      </div>
    );
  }

  const clinic: ClinicRecord = clinicQuery.data;

  async function completeStep(stepId: number, patch: Partial<WizardSummary>) {
    setSummary((prev) => ({ ...prev, ...patch }));
    try {
      // Contract: persist wizard progress after every successful step action.
      await advanceStep.mutateAsync(stepId);
    } catch (err) {
      toast.error(
        'Progress not saved',
        apiErrorMessage(err, 'Your changes were saved, but we could not record wizard progress.'),
      );
    }
    const next = clampStep(stepId + 1);
    setCurrentStep(next);
    setMaxUnlockedStep((prev) => Math.max(prev, next));
  }

  function goBack() {
    setCurrentStep((step) => Math.max(1, step - 1));
  }

  function goToStep(step: number) {
    if (step <= maxUnlockedStep) setCurrentStep(step);
  }

  function handleActivated(updated: ClinicRecord) {
    const { user, accessToken, refreshToken } = useAuthStore.getState();
    if (user && accessToken) {
      useAuthStore.getState().setSession({
        user,
        accessToken,
        refreshToken: refreshToken ?? undefined,
        onboardingComplete: true,
      });
    }
    toast.success('Clinic activated', `${updated.name} is now live.`);
    navigate('/dashboard', { replace: true });
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Set up your clinic"
        description="A few quick steps before your team can start using ClinicOS."
      />
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <Card className="h-fit p-4 sm:p-5">
          <StepRail currentStep={currentStep} maxUnlockedStep={maxUnlockedStep} onSelect={goToStep} />
        </Card>

        <Card key={currentStep}>
          {currentStep === 1 && (
            <ClinicIdentityStep clinic={clinic} onComplete={(patch) => completeStep(1, patch)} />
          )}
          {currentStep === 2 && (
            <AddressContactStep
              branchId={branchId}
              onBack={goBack}
              onComplete={(patch) => completeStep(2, patch)}
            />
          )}
          {currentStep === 3 && (
            <WorkingHoursStep
              branchId={branchId}
              onBack={goBack}
              onComplete={(patch) => completeStep(3, patch)}
            />
          )}
          {currentStep === 4 && (
            <AddDoctorsStep branchId={branchId} onBack={goBack} onComplete={(patch) => completeStep(4, patch)} />
          )}
          {currentStep === 5 && (
            <ConsultationFeeStep onBack={goBack} onComplete={(patch) => completeStep(5, patch)} />
          )}
          {currentStep === 6 && (
            <QueueRulesStep onBack={goBack} onComplete={(patch) => completeStep(6, patch)} />
          )}
          {currentStep === 7 && (
            <PrescriptionBrandingStep
              clinic={clinic}
              onBack={goBack}
              onComplete={(patch) => completeStep(7, patch)}
            />
          )}
          {currentStep === 8 && (
            <InviteStaffStep branchId={branchId} onBack={goBack} onComplete={(patch) => completeStep(8, patch)} />
          )}
          {currentStep === 9 && (
            <ReviewActivateStep clinic={clinic} summary={summary} onBack={goBack} onActivated={handleActivated} />
          )}
        </Card>
      </div>
    </div>
  );
}

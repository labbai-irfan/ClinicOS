import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS } from '../steps-meta';

interface StepRailProps {
  currentStep: number;
  /** Furthest step the clinic has actually reached (persisted server-side). */
  maxUnlockedStep: number;
  onSelect: (step: number) => void;
}

/** Left rail: progress bar + clickable list of completed / current / upcoming steps. */
export function StepRail({ currentStep, maxUnlockedStep, onSelect }: StepRailProps) {
  const progressPercent = Math.round((currentStep / TOTAL_ONBOARDING_STEPS) * 100);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">
            Step {currentStep} of {TOTAL_ONBOARDING_STEPS}
          </span>
          <span className="text-text-secondary">{progressPercent}%</span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Onboarding progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <ol className="space-y-1">
        {ONBOARDING_STEPS.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isUnlocked = step.id <= maxUnlockedStep;

          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => isUnlocked && onSelect(step.id)}
                disabled={!isUnlocked}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex w-full min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  isCurrent && 'bg-primary/10',
                  isUnlocked && !isCurrent && 'hover:bg-surface-muted',
                  !isUnlocked && 'cursor-not-allowed opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    isCompleted && 'border-success bg-success text-white',
                    isCurrent && 'border-primary text-primary',
                    !isCompleted && !isCurrent && 'border-border text-text-secondary',
                  )}
                  aria-hidden="true"
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-sm font-medium',
                      isCurrent ? 'text-text-primary' : 'text-text-secondary',
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">{step.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

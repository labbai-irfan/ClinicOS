import { Button } from '../../../components/ui/Button';

interface StepFooterProps {
  onBack?: () => void;
  backLabel?: string;
  continueLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Provide when this footer is NOT nested inside its own <form> (e.g. a step whose
   *  body already contains another form, such as the staff-invite steps) — renders the
   *  Continue button as type="button" instead of type="submit" to avoid nested forms. */
  onContinueClick?: () => void;
}

/** Consistent Back / Continue actions for every wizard step. */
export function StepFooter({
  onBack,
  backLabel = 'Back',
  continueLabel = 'Continue',
  loading,
  disabled,
  onContinueClick,
}: StepFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
          {backLabel}
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
      {onContinueClick ? (
        <Button type="button" onClick={onContinueClick} loading={loading} disabled={disabled}>
          {continueLabel}
        </Button>
      ) : (
        <Button type="submit" loading={loading} disabled={disabled}>
          {continueLabel}
        </Button>
      )}
    </div>
  );
}

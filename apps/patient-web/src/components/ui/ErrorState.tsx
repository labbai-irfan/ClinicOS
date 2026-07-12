import { AlertCircle, WifiOff } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = "Something didn't load",
  description = 'Please try again. If this keeps happening, contact your administrator.',
  onRetry,
  offline,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
}) {
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-10 text-center">
      <Icon className="h-10 w-10 text-danger" aria-hidden="true" />
      <div>
        <p className="font-medium text-text-primary">{offline ? 'You are offline' : title}</p>
        <p className="mt-1 text-sm text-text-secondary">
          {offline ? 'Check your connection. Unsaved drafts are kept locally.' : description}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

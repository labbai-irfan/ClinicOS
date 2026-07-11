import { ShieldAlert } from 'lucide-react';

export function PermissionDenied({
  message = 'You do not have permission to view this page.',
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-muted p-10 text-center">
      <ShieldAlert className="h-10 w-10 text-text-secondary" aria-hidden="true" />
      <p className="font-medium text-text-primary">Access restricted</p>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

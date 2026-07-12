import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Banknote, CalendarPlus, Search, Siren, UserPlus } from 'lucide-react';
import { PERMISSIONS, type Permission } from '@clinicos/types';
import { usePermission } from '../../../hooks/use-permission';
import { cn } from '../../../lib/utils';

type QuickActionVariant = 'primary' | 'secondary' | 'danger';

interface QuickAction {
  label: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
  variant: QuickActionVariant;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Add Walk-In',
    to: '/patients/new',
    icon: UserPlus,
    permission: PERMISSIONS.PATIENT_CREATE,
    variant: 'primary',
  },
  {
    label: 'Book Appointment',
    to: '/appointments',
    icon: CalendarPlus,
    permission: PERMISSIONS.APPOINTMENT_CREATE,
    variant: 'secondary',
  },
  {
    label: 'Find Patient',
    to: '/patients',
    icon: Search,
    permission: PERMISSIONS.PATIENT_READ_BASIC,
    variant: 'secondary',
  },
  {
    label: 'Emergency Entry',
    to: '/emergency/new',
    icon: Siren,
    permission: PERMISSIONS.EMERGENCY_CREATE,
    variant: 'danger',
  },
  {
    label: 'Add Payment',
    to: '/billing',
    icon: Banknote,
    permission: PERMISSIONS.BILLING_CREATE,
    variant: 'secondary',
  },
];

const VARIANT_CLASSES: Record<QuickActionVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-surface-muted text-text-primary border border-border hover:bg-border/60',
  danger: 'bg-danger text-white hover:opacity-90',
};

/** Quick-action row (spec §10) — each link is gated by usePermission() and hidden, not disabled, when denied. */
export function QuickActions() {
  const { has } = usePermission();
  const visibleActions = QUICK_ACTIONS.filter((action) => has(action.permission));

  if (visibleActions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Quick actions">
      {visibleActions.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded px-4 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            VARIANT_CLASSES[action.variant],
          )}
        >
          <action.icon className="h-4 w-4" aria-hidden="true" />
          {action.label}
        </Link>
      ))}
    </div>
  );
}

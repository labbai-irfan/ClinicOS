import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Menu, LogOut, User, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { usePatientAuthStore } from '../../stores/auth-store-patient';
import { useThemeToggle } from '../../hooks/use-theme';
import { IconButton } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

const THEME_ICON = { system: MonitorSmartphone, light: Sun, dark: Moon } as const;
const THEME_LABEL = { system: 'System theme (click for light)', light: 'Light theme (click for dark)', dark: 'Dark theme (click for system)' } as const;

export function HeaderPatient({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  // Two separate primitive selectors, not one selector returning a new object literal —
  // Zustand's default equality check is reference equality, so an inline object selector
  // (`(s) => ({ name: s.name, email: s.email })`) returns a fresh reference on every call
  // and never compares equal to its previous result, causing an infinite render loop
  // ("Maximum update depth exceeded") the moment this component mounts.
  const name = usePatientAuthStore((s) => s.name);
  const email = usePatientAuthStore((s) => s.email);
  const logout = usePatientAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { theme, cycleTheme } = useThemeToggle();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        onClick={onOpenMobileNav}
        aria-label="Open navigation menu"
        className="flex h-11 w-11 items-center justify-center rounded text-text-secondary hover:bg-surface-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden text-sm text-text-secondary sm:block">
        {format(new Date(), 'EEEE, d MMMM yyyy')}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <IconButton label={THEME_LABEL[theme]} icon={THEME_ICON[theme]} onClick={cycleTheme} />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className={cn(
                'flex min-h-[44px] items-center gap-2 rounded px-2 text-sm font-medium text-text-primary hover:bg-surface-muted',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline">{name}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[200px] rounded border border-border bg-surface p-1 shadow-popover"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-text-primary">{name}</p>
                <p className="text-xs text-text-secondary">{email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item asChild>
                <Link
                  to="/profile"
                  className="flex min-h-[40px] items-center gap-2 rounded px-3 text-sm text-text-primary outline-none hover:bg-surface-muted"
                >
                  <User className="h-4 w-4" /> My Profile
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={handleLogout}
                className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-3 text-sm text-danger outline-none hover:bg-danger/10"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

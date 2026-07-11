import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Menu, Plus, LogOut, User, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { useLogoutMutation } from '../../features/auth/api';
import { usePermission } from '../../hooks/use-permission';
import { useUnreadNotificationCountQuery } from '../../features/notifications/api';
import { PERMISSIONS } from '@clinicos/types';
import { IconButton } from '../ui/Tooltip';
import { cn } from '../../lib/utils';

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogoutMutation();
  const navigate = useNavigate();
  const { has } = usePermission();
  const canViewNotifications = has(PERMISSIONS.NOTIFICATION_READ);
  const { data: unreadCount } = useUnreadNotificationCountQuery(canViewNotifications);

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
        {has(PERMISSIONS.PATIENT_CREATE) && (
          <Link
            to="/patients/new"
            className="hidden items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover sm:inline-flex min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            Add Walk-In
          </Link>
        )}

        <div className="relative">
          <IconButton
            label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            icon={Bell}
            onClick={() => navigate('/notifications')}
          />
          {canViewNotifications && !!unreadCount && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

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
              <span className="hidden sm:inline">{user?.name}</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[200px] rounded border border-border bg-surface p-1 shadow-popover"
            >
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-text-primary">{user?.name}</p>
                <p className="text-xs text-text-secondary">{user?.email}</p>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              {has(PERMISSIONS.SETTINGS_MANAGE) && (
                <DropdownMenu.Item asChild>
                  <Link
                    to="/admin/settings"
                    className="flex min-h-[40px] items-center gap-2 rounded px-3 text-sm text-text-primary outline-none hover:bg-surface-muted"
                  >
                    <Settings className="h-4 w-4" /> Clinic Settings
                  </Link>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                onSelect={() => logout.mutate()}
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

import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, Stethoscope } from 'lucide-react';
import { NAV_ITEMS } from '../../nav-config';
import { usePermission } from '../../hooks/use-permission';
import { useUiStore } from '../../stores/ui-store';
import { cn } from '../../lib/utils';

function NavLinkRow({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
}: {
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-h-[44px] items-center gap-3 rounded px-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
        )
      }
    >
      {Icon && <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}

export function Sidebar({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { has } = usePermission();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const collapsed = mobile ? false : sidebarCollapsed;

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || has(item.permission)).map(
    (item) => ({
      ...item,
      children: item.children?.filter((c) => !c.permission || has(c.permission)),
    }),
  );

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'flex h-full flex-col border-r border-border bg-surface',
        collapsed ? 'w-16' : 'w-64',
      )}
      onClick={onNavigate}
    >
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Stethoscope className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
        {!collapsed && <span className="text-lg font-semibold text-text-primary">ClinicOS</span>}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {visibleItems.map((item) => (
          <Fragment key={item.to}>
            <NavLinkRow to={item.to} label={item.label} icon={item.icon} collapsed={collapsed} end />
            {!collapsed && item.children && item.children.length > 0 && (
              <div className="ml-8 space-y-1 border-l border-border pl-2">
                {item.children.map((child) => (
                  <NavLinkRow key={child.to} to={child.to} label={child.label} collapsed={false} />
                ))}
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {!mobile && (
        <button
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex min-h-[44px] items-center justify-center gap-2 border-t border-border text-text-secondary hover:bg-surface-muted"
        >
          <ChevronLeft className={cn('h-5 w-5 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      )}
    </nav>
  );
}

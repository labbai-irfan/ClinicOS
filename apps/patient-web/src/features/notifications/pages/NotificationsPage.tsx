import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Bell,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  Settings2,
  Siren,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NOTIFICATION_CATEGORIES } from '@clinicos/types';
import type { NotificationCategory, NotificationDto } from '@clinicos/types';
import { DEFAULTS } from '@clinicos/config';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select';
import { QueryBoundary } from '../../../components/QueryBoundary';
import { toast } from '../../../components/ui/Toast';
import { apiErrorMessage } from '../../../lib/api-client';
import { cn } from '../../../lib/utils';
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationPreferencesQuery,
  useNotificationsQuery,
  useUpdatePreferencesMutation,
} from '../api';

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  queue: 'Queue',
  emergency: 'Emergency',
  appointment: 'Appointments',
  billing: 'Billing',
  follow_up: 'Follow-ups',
  document: 'Documents',
  system: 'System',
};

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  queue: Users,
  emergency: Siren,
  appointment: CalendarDays,
  billing: Receipt,
  follow_up: CalendarClock,
  document: FileText,
  system: Settings2,
};

const CATEGORY_FILTER_ALL = 'all' as const;
type CategoryFilter = typeof CATEGORY_FILTER_ALL | NotificationCategory;

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export default function NotificationsPage() {
  const navigate = useNavigate();

  const [category, setCategory] = useState<CategoryFilter>(CATEGORY_FILTER_ALL);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const limit = DEFAULTS.PAGE_SIZE;

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [category, unreadOnly]);

  const { data, isLoading, isError, refetch } = useNotificationsQuery({
    category: category === CATEGORY_FILTER_ALL ? undefined : category,
    unreadOnly: unreadOnly || undefined,
    page,
    limit,
  });

  const markRead = useMarkReadMutation();
  const markAllRead = useMarkAllReadMutation();
  const preferences = useNotificationPreferencesQuery();
  const updatePreferences = useUpdatePreferencesMutation();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasFilters = category !== CATEGORY_FILTER_ALL || unreadOnly;

  async function handleOpen(notification: NotificationDto) {
    if (!notification.read) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch (err) {
        toast.error('Could not mark as read', apiErrorMessage(err));
        return;
      }
    }
    if (notification.link) navigate(notification.link);
  }

  async function handleMarkAllRead() {
    try {
      const result = await markAllRead.mutateAsync();
      toast.success('Inbox updated', `${result.updated} notification${result.updated === 1 ? '' : 's'} marked as read.`);
    } catch (err) {
      toast.error('Could not mark all as read', apiErrorMessage(err));
    }
  }

  function handleTogglePreference(cat: NotificationCategory, next: boolean) {
    updatePreferences.mutate(
      { [cat]: next },
      { onError: (err) => toast.error('Could not save preference', apiErrorMessage(err)) },
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates about queue activity, appointments, billing, and more."
        actions={
          <Button variant="outline" onClick={() => void handleMarkAllRead()} loading={markAllRead.isPending}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark All Read
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
          <SelectTrigger className="w-52" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CATEGORY_FILTER_ALL}>All categories</SelectItem>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex min-h-[44px] items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-border accent-primary"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        data={data}
        onRetry={() => void refetch()}
        isEmpty={(d) => d.items.length === 0}
        emptyTitle={hasFilters ? 'No notifications match your filters' : 'No notifications yet'}
        emptyDescription={
          hasFilters
            ? 'Try a different category or clear "Unread only".'
            : "You'll see queue, appointment, billing, and other clinic updates here."
        }
      >
        {(result) => (
          <>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {result.items.map((notification) => {
                  const CategoryIcon = CATEGORY_ICONS[notification.category];
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpen(notification)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-inset',
                          !notification.link && 'cursor-default',
                        )}
                      >
                        <span className="mt-0.5 shrink-0" aria-hidden="true">
                          {notification.read ? (
                            <Bell className="h-5 w-5 text-text-secondary" />
                          ) : (
                            <BellRing className="h-5 w-5 text-primary" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-sm text-text-primary',
                                !notification.read && 'font-semibold',
                              )}
                            >
                              {notification.title}
                            </span>
                            {!notification.read && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                                New
                              </span>
                            )}
                            <StatusPill
                              label={CATEGORY_LABELS[notification.category]}
                              tone="neutral"
                            />
                            {notification.priority === 'critical' && (
                              <StatusPill label="Critical" tone="danger" />
                            )}
                            {notification.priority === 'high' && (
                              <StatusPill label="High priority" tone="warning" />
                            )}
                          </span>
                          {notification.body && (
                            <span className="mt-1 block text-sm text-text-secondary">
                              {notification.body}
                            </span>
                          )}
                          <span className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                            {relativeTime(notification.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-text-secondary">
                {result.total} notification{result.total === 1 ? '' : 's'} · Page {result.page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>

      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardTitle>Notification preferences</CardTitle>
            <CardDescription>Choose which categories you want to be notified about.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <QueryBoundary
            isLoading={preferences.isLoading}
            isError={preferences.isError}
            data={preferences.data}
            onRetry={() => void preferences.refetch()}
            loadingFallback={
              <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading preferences">
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <div key={c} className="h-11 animate-pulse rounded bg-surface-muted" />
                ))}
              </div>
            }
          >
            {(categories) => (
              <div className="grid gap-3 sm:grid-cols-2">
                {NOTIFICATION_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  return (
                    <label
                      key={c}
                      htmlFor={`pref-${c}`}
                      className="flex min-h-[44px] items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm text-text-primary"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
                        {CATEGORY_LABELS[c]}
                      </span>
                      <input
                        id={`pref-${c}`}
                        type="checkbox"
                        className="h-5 w-5 rounded border-border accent-primary"
                        checked={categories[c] ?? true}
                        onChange={(e) => handleTogglePreference(c, e.target.checked)}
                        aria-label={`Notify me about ${CATEGORY_LABELS[c]}`}
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </QueryBoundary>
        </CardContent>
      </Card>
    </div>
  );
}

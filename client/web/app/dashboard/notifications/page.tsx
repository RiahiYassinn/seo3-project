"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRing,
  CheckCheck,
  CircleAlert,
  Filter as FilterIcon,
  Inbox,
  Loader2,
  MailOpen,
  RefreshCw,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { NotificationIcon } from "@/components/notifications/notification-icon";
import {
  connectNotificationStream,
  selectUnreadCount,
  useNotificationStore,
} from "@/lib/notifications-store";
import {
  type AppNotification,
  formatNotificationDateTime,
  formatNotificationTime,
  groupNotificationsByDay,
  notificationTypeMeta,
  priorityLabel,
  priorityTone,
} from "@/lib/notifications";
import { useAuthStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "unread" | "read";

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export default function NotificationCenterPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  const notifications = useNotificationStore((state) => state.notifications);
  const loading = useNotificationStore((state) => state.loading);
  const initialized = useNotificationStore((state) => state.initialized);
  const mutating = useNotificationStore((state) => state.mutating);
  const busyIds = useNotificationStore((state) => state.busyIds);
  const error = useNotificationStore((state) => state.error);
  const load = useNotificationStore((state) => state.load);
  const markRead = useNotificationStore((state) => state.markRead);
  const markUnread = useNotificationStore((state) => state.markUnread);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const remove = useNotificationStore((state) => state.remove);
  const removeMany = useNotificationStore((state) => state.removeMany);
  const clearError = useNotificationStore((state) => state.clearError);
  const unreadCount = useNotificationStore(selectUnreadCount);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    load();
    return connectNotificationStream();
  }, [hasHydrated, load, router, user]);

  const availableTypes = useMemo(() => {
    const types = new Set(notifications.map((item) => item.type));
    return Array.from(types).sort();
  }, [notifications]);

  const availablePriorities = useMemo(() => {
    const priorities = new Set(notifications.map((item) => item.priority));
    return Array.from(priorities);
  }, [notifications]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      if (status === "unread" && notification.is_read) return false;
      if (status === "read" && !notification.is_read) return false;
      if (typeFilter !== "all" && notification.type !== typeFilter) return false;
      if (priorityFilter !== "all" && notification.priority !== priorityFilter) {
        return false;
      }

      if (!term) return true;

      return (
        notification.title.toLowerCase().includes(term) ||
        notification.message.toLowerCase().includes(term)
      );
    });
  }, [notifications, priorityFilter, search, status, typeFilter]);

  const groups = useMemo(() => groupNotificationsByDay(filtered), [filtered]);

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return {
      total: notifications.length,
      unread: unreadCount,
      urgent: notifications.filter(
        (item) =>
          !item.is_read &&
          (item.priority === "high" || item.priority === "critical"),
      ).length,
      recent: notifications.filter(
        (item) => new Date(item.created_at).getTime() >= weekAgo,
      ).length,
    };
  }, [notifications, unreadCount]);

  const filtersActive =
    status !== "all" ||
    typeFilter !== "all" ||
    priorityFilter !== "all" ||
    search.trim() !== "";

  const resetFilters = () => {
    setStatus("all");
    setTypeFilter("all");
    setPriorityFilter("all");
    setSearch("");
  };

  // Selection is scoped to what is currently visible.
  const visibleIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const selection = useMemo(
    () => selectedIds.filter((id) => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selection.length === visibleIds.length;

  const toggleSelection = (notificationId: string) => {
    setSelectedIds((current) =>
      current.includes(notificationId)
        ? current.filter((id) => id !== notificationId)
        : [...current, notificationId],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleIds);
  };

  const bulkMarkRead = async () => {
    await Promise.all(selection.map((id) => markRead(id)));
    setSelectedIds([]);
  };

  const bulkMarkUnread = async () => {
    await Promise.all(selection.map((id) => markUnread(id)));
    setSelectedIds([]);
  };

  const bulkDelete = async () => {
    await removeMany(selection);
    setSelectedIds([]);
    setConfirmingBulkDelete(false);
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  if (!hasHydrated || (loading && !initialized)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex h-[calc(100vh-64px)] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.08),transparent_22%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%)]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
              Notification center
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              Your inbox
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Review, filter, and clean up every update from analysis,
              mentorship, and admin activity in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => load({ silent: true })}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button
              className="gap-2"
              onClick={() => markAllRead()}
              disabled={unreadCount === 0 || mutating}
            >
              {mutating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Mark all read
            </Button>
          </div>
        </header>

        {error ? (
          <Card className="mb-6 border-destructive/40 bg-destructive/10">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
              <CircleAlert className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearError();
                  load();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: Inbox, tone: "text-foreground" },
            { label: "Unread", value: stats.unread, icon: BellRing, tone: "text-primary" },
            {
              label: "Needs attention",
              value: stats.urgent,
              icon: CircleAlert,
              tone: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Last 7 days",
              value: stats.recent,
              icon: MailOpen,
              tone: "text-foreground",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="border-border/60 bg-background/80 shadow-sm"
            >
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className={cn("mt-2 text-3xl font-semibold", stat.tone)}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon className="h-5 w-5 text-muted-foreground/60" />
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="overflow-hidden border-border/60 bg-background/85 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg bg-muted p-0.5">
              {statusFilters.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatus(option.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    status === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                  {option.value === "unread" && unreadCount > 0 ? (
                    <span className="ml-1.5 text-xs font-semibold text-primary">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notifications"
                  className="pl-9"
                  aria-label="Search notifications"
                />
              </div>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="sm:w-[11rem]" aria-label="Filter by type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {availableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {notificationTypeMeta(type).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger
                  className="sm:w-[9.5rem]"
                  aria-label="Filter by priority"
                >
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {availablePriorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filtersActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="gap-1.5 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all notifications"
                />
                {selection.length > 0
                  ? `${selection.length} selected`
                  : `Select all (${filtered.length})`}
              </label>

              {selection.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={bulkMarkRead}
                    disabled={mutating}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark read
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={bulkMarkUnread}
                    disabled={mutating}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Mark unread
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setConfirmingBulkDelete(true)}
                    disabled={mutating}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                {filtersActive ? (
                  <FilterIcon className="h-6 w-6" />
                ) : (
                  <Inbox className="h-6 w-6" />
                )}
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                {filtersActive
                  ? "No notifications match these filters"
                  : "Your inbox is empty"}
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {filtersActive
                  ? "Try a different search term, or clear the filters to see everything."
                  : "Updates from analysis, mentorship, and admin activity will show up here as soon as they happen."}
              </p>
              {filtersActive ? (
                <Button variant="outline" className="mt-5" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div>
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="border-b border-border/60 bg-muted/10 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="divide-y divide-border/60">
                    {group.items.map((notification) => {
                      const tone = priorityTone(notification.priority);
                      const meta = notificationTypeMeta(notification.type);
                      const isSelected = selection.includes(notification.id);
                      const isBusy = busyIds.includes(notification.id);

                      return (
                        <li
                          key={notification.id}
                          className={cn(
                            "group relative flex gap-3 px-4 py-4 transition-colors sm:gap-4",
                            !notification.is_read && "bg-primary/[0.035]",
                            isSelected && "bg-primary/[0.07]",
                            isBusy && "pointer-events-none opacity-50",
                          )}
                        >
                          {!notification.is_read ? (
                            <span
                              className={cn(
                                "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                                tone.rail,
                              )}
                            />
                          ) : null}

                          <div className="flex items-start pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleSelection(notification.id)
                              }
                              aria-label={`Select ${notification.title}`}
                            />
                          </div>

                          <NotificationIcon
                            type={notification.type}
                            priority={notification.priority}
                            size="md"
                            muted={notification.is_read}
                            className="hidden sm:flex"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3
                                className={cn(
                                  "text-sm leading-5",
                                  notification.is_read
                                    ? "font-medium text-muted-foreground"
                                    : "font-semibold",
                                )}
                              >
                                {notification.title}
                              </h3>
                              {!notification.is_read ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                  New
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {notification.message}
                            </p>

                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="gap-1.5 text-xs">
                                <meta.icon className="h-3 w-3" />
                                {meta.label}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", tone.badge)}
                              >
                                {priorityLabel(notification.priority)}
                              </Badge>
                              <span
                                className="text-xs text-muted-foreground"
                                title={formatNotificationDateTime(
                                  notification.created_at,
                                )}
                              >
                                {formatNotificationTime(notification.created_at)}
                              </span>
                              {notification.recipient_role ? (
                                <span className="text-xs text-muted-foreground">
                                  · Sent to {notification.recipient_role.replace(/_/g, " ")}
                                </span>
                              ) : null}
                            </div>

                            {notification.link ? (
                              <Button
                                asChild
                                variant="link"
                                size="sm"
                                className="mt-1.5 h-auto gap-1.5 p-0 text-xs"
                              >
                                <Link
                                  href={notification.link}
                                  onClick={() => markRead(notification.id)}
                                >
                                  View details
                                  <ArrowRight className="h-3 w-3" />
                                </Link>
                              </Button>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-start gap-1 opacity-100 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              aria-label={
                                notification.is_read
                                  ? "Mark as unread"
                                  : "Mark as read"
                              }
                              title={
                                notification.is_read
                                  ? "Mark as unread"
                                  : "Mark as read"
                              }
                              onClick={() =>
                                notification.is_read
                                  ? markUnread(notification.id)
                                  : markRead(notification.id)
                              }
                            >
                              {notification.is_read ? (
                                <Undo2 className="h-4 w-4" />
                              ) : (
                                <CheckCheck className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              aria-label="Delete notification"
                              title="Delete"
                              onClick={() => remove(notification.id)}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

      <AlertDialog
        open={confirmingBulkDelete}
        onOpenChange={setConfirmingBulkDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selection.length}{" "}
              {selection.length === 1 ? "notification" : "notifications"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from your inbox permanently. Announcements sent
              to your whole role stay visible for everyone else.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={bulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

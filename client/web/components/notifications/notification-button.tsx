"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
  Settings2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  connectNotificationStream,
  selectUnreadCount,
  useNotificationStore,
} from "@/lib/notifications-store";
import {
  type AppNotification,
  formatNotificationTime,
  groupNotificationsByDay,
  priorityTone,
} from "@/lib/notifications";
import { NotificationIcon } from "@/components/notifications/notification-icon";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

export function NotificationButton({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const notifications = useNotificationStore((state) => state.notifications);
  const loading = useNotificationStore((state) => state.loading);
  const initialized = useNotificationStore((state) => state.initialized);
  const mutating = useNotificationStore((state) => state.mutating);
  const error = useNotificationStore((state) => state.error);
  const load = useNotificationStore((state) => state.load);
  const markRead = useNotificationStore((state) => state.markRead);
  const markUnread = useNotificationStore((state) => state.markUnread);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const remove = useNotificationStore((state) => state.remove);
  const unreadCount = useNotificationStore(selectUnreadCount);

  useEffect(() => {
    load();
    return connectNotificationStream();
  }, [load]);

  useEffect(() => {
    if (open) {
      load({ silent: true });
    }
  }, [load, open]);

  const visible = useMemo(
    () =>
      filter === "unread"
        ? notifications.filter((notification) => !notification.is_read)
        : notifications,
    [filter, notifications],
  );

  const groups = useMemo(
    () => groupNotificationsByDay(visible.slice(0, 12)),
    [visible],
  );

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);

    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className={cn(
            "relative h-9 w-9 shrink-0 transition-colors",
            unreadCount > 0 && "border-primary/40 text-primary",
            className,
          )}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <>
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-sm ring-2 ring-background">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
              <span className="absolute -right-1 -top-1 h-[18px] w-[18px] animate-ping rounded-full bg-primary/40" />
            </>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(calc(100vw-2rem),26rem)] overflow-hidden rounded-xl p-0 shadow-lg"
      >
        <div className="border-b bg-muted/30 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">Notifications</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {unreadCount === 0
                  ? "You're all caught up"
                  : `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Mark all as read"
                title="Mark all as read"
                onClick={() => markAllRead()}
                disabled={unreadCount === 0 || mutating}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {mutating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
              </Button>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Manage notifications"
                title="Manage notifications"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Link
                  href="/dashboard/notifications"
                  onClick={() => setOpen(false)}
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-3 inline-flex rounded-lg bg-muted p-0.5">
            {(["all", "unread"] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                  filter === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
                {value === "unread" && unreadCount > 0 ? (
                  <span className="ml-1.5 text-[10px] font-semibold text-primary">
                    {unreadCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between gap-3 border-b bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
            <span className="min-w-0 flex-1">{error}</span>
            <button
              type="button"
              onClick={() => load()}
              className="shrink-0 font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading && !initialized ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">
              {filter === "unread" ? "No unread notifications" : "Nothing here yet"}
            </p>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs leading-5 text-muted-foreground">
              {filter === "unread"
                ? "Every update has been read."
                : "Updates from analysis, mentorship, and admin activity land here."}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[24rem]">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="sticky top-0 z-10 bg-background/95 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {group.label}
                </p>
                <div className="divide-y divide-border/60">
                  {group.items.map((notification) => {
                    const tone = priorityTone(notification.priority);

                    return (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openNotification(notification)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openNotification(notification);
                          }
                        }}
                        className={cn(
                          "group relative flex cursor-pointer gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
                          !notification.is_read && "bg-primary/[0.04]",
                        )}
                      >
                        {!notification.is_read ? (
                          <span
                            className={cn(
                              "absolute inset-y-2 left-0 w-[3px] rounded-r-full",
                              tone.rail,
                            )}
                          />
                        ) : null}

                        <NotificationIcon
                          type={notification.type}
                          priority={notification.priority}
                          muted={notification.is_read}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "line-clamp-1 text-sm leading-5",
                                notification.is_read
                                  ? "font-medium text-muted-foreground"
                                  : "font-semibold",
                              )}
                            >
                              {notification.title}
                            </p>
                            <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-muted-foreground group-hover:opacity-0">
                              {formatNotificationTime(notification.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {notification.message}
                          </p>
                        </div>

                        <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
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
                            onClick={(event) => {
                              event.stopPropagation();
                              if (notification.is_read) {
                                markUnread(notification.id);
                              } else {
                                markRead(notification.id);
                              }
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:text-foreground"
                          >
                            {notification.is_read ? (
                              <Undo2 className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCheck className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label="Delete notification"
                            title="Delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              remove(notification.id);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </ScrollArea>
        )}

        <div className="border-t bg-muted/20 p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-xs font-medium"
          >
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
              Open notification center
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

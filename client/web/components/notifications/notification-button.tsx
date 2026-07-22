"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Inbox, Loader2 } from "lucide-react";
import {
  type AppNotification,
  notificationsAPI,
  subscribeToNotifications,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const priorityStyles: Record<string, string> = {
  info: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  critical:
    "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200",
};

interface NotificationButtonProps {
  className?: string;
}

export function NotificationButton({ className }: NotificationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const data = await notificationsAPI.list();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    // Realtime updates arrive over SSE; this is just a safety-net refresh
    // in case a push is missed (e.g. during a reconnect window).
    const interval = window.setInterval(loadNotifications, 300000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [loadNotifications, open]);

  useEffect(() => {
    const unsubscribe = subscribeToNotifications((notification) => {
      setNotifications((current) => {
        if (current.some((item) => item.id === notification.id)) {
          return current;
        }
        return [notification, ...current];
      });

      if (!notification.is_read) {
        setUnreadCount((current) => current + 1);
      }
    });

    return unsubscribe;
  }, []);

  const orderedNotifications = useMemo(
    () =>
      notifications
        .slice()
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime(),
        ),
    [notifications],
  );

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.is_read) {
      try {
        const updatedNotification = await notificationsAPI.markRead(
          notification.id,
        );
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, ...updatedNotification, is_read: true }
              : item,
          ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (requestError) {
        console.error("Failed to mark notification as read", requestError);
      }
    }

    if (notification.link) {
      setOpen(false);
      router.push(notification.link);
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);

    try {
      const data = await notificationsAPI.markAllRead();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setError("");
    } catch (requestError: any) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Unable to update notifications",
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="View notifications"
          className={cn("relative h-9 w-9 shrink-0", className)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-2rem),24rem)] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount === 0
                ? "Everything is read"
                : `${unreadCount} unread`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || markingAll}
            className="gap-2"
          >
            {markingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Read all
          </Button>
        </div>

        {error ? (
          <div className="border-b bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && orderedNotifications.length === 0 ? (
          <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading notifications
          </div>
        ) : orderedNotifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Inbox className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Updates from analysis, mentorship, and admin activity will appear
              here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <div className="divide-y">
              {orderedNotifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-muted/70",
                    !notification.is_read && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1 h-2.5 w-2.5 shrink-0 rounded-full border",
                        priorityStyles[notification.priority] ||
                          priorityStyles.info,
                        notification.is_read && "opacity-35",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={cn(
                            "text-sm font-medium leading-5",
                            notification.is_read && "text-muted-foreground",
                          )}
                        >
                          {notification.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            { addSuffix: true },
                          )}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

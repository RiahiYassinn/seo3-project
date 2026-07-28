import {
  Bell,
  CalendarClock,
  CircleCheck,
  CircleX,
  GitPullRequest,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNow, isThisYear, isToday, isYesterday } from "date-fns";
import api from "@/lib/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:3006";

export interface AppNotification {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  priority: "info" | "success" | "warning" | "high" | "critical" | string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread_count: number;
}

export const notificationsAPI = {
  async list(limit = 100) {
    const response = await api.get<NotificationsResponse>("/notifications/me", {
      params: { limit },
    });

    return response.data;
  },

  async markRead(notificationId: string) {
    const response = await api.post<AppNotification>(
      `/notifications/${notificationId}/read`,
    );

    return response.data;
  },

  async markUnread(notificationId: string) {
    const response = await api.post<AppNotification>(
      `/notifications/${notificationId}/unread`,
    );

    return response.data;
  },

  async markAllRead() {
    const response = await api.post<NotificationsResponse>(
      "/notifications/read-all",
    );

    return response.data;
  },

  async remove(notificationId: string) {
    await api.delete(`/notifications/${notificationId}`);
  },

  async removeMany(notificationIds: string[]) {
    const response = await api.post<NotificationsResponse>(
      "/notifications/bulk-delete",
      { ids: notificationIds },
    );

    return response.data;
  },
};

export function subscribeToNotifications(
  onNotification: (notification: AppNotification) => void,
  onError?: (event: Event) => void,
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => {};
  }

  const source = new EventSource(
    `${API_BASE_URL}/api/v1/notifications/stream`,
    { withCredentials: true },
  );

  source.addEventListener("notification", (event) => {
    try {
      const notification = JSON.parse(
        (event as MessageEvent).data,
      ) as AppNotification;
      onNotification(notification);
    } catch (parseError) {
      console.error("Failed to parse notification event", parseError);
    }
  });

  if (onError) {
    source.onerror = onError;
  }

  return () => source.close();
}

/* -------------------------------------------------------------------------- */
/*                            Presentation metadata                           */
/* -------------------------------------------------------------------------- */

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export interface PriorityTone {
  label: string;
  /** Small solid dot / icon chip background. */
  chip: string;
  /** Outline badge styling. */
  badge: string;
  /** 3px accent rail on the left of an unread row. */
  rail: string;
}

export const priorityTones: Record<string, PriorityTone> = {
  info: {
    label: "Info",
    chip: "bg-sky-500/12 text-sky-600 dark:text-sky-300 ring-1 ring-inset ring-sky-500/25",
    badge:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    rail: "bg-sky-500",
  },
  success: {
    label: "Success",
    chip: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/25",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    rail: "bg-emerald-500",
  },
  warning: {
    label: "Warning",
    chip: "bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rail: "bg-amber-500",
  },
  high: {
    label: "High",
    chip: "bg-violet-500/12 text-violet-600 dark:text-violet-300 ring-1 ring-inset ring-violet-500/25",
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    rail: "bg-violet-500",
  },
  critical: {
    label: "Critical",
    chip: "bg-rose-500/12 text-rose-600 dark:text-rose-300 ring-1 ring-inset ring-rose-500/25",
    badge:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    rail: "bg-rose-500",
  },
};

export function priorityTone(priority?: string | null): PriorityTone {
  return priorityTones[String(priority || "info")] || priorityTones.info;
}

/** Title-cases unknown priorities instead of mislabelling them as "Info". */
export function priorityLabel(priority?: string | null): string {
  const key = String(priority || "info");
  return priorityTones[key]?.label || titleCase(key);
}

interface NotificationTypeMeta {
  label: string;
  icon: LucideIcon;
}

const typeMeta: Record<string, NotificationTypeMeta> = {
  learning_path_ready: { label: "Learning path", icon: Sparkles },
  mentor_request_created: { label: "Mentor request", icon: UserPlus },
  mentor_request_accepted: { label: "Mentor accepted", icon: CircleCheck },
  mentor_request_declined: { label: "Mentor declined", icon: CircleX },
  mentorship_session_scheduled: { label: "Session scheduled", icon: CalendarClock },
  recommendation: { label: "Recommendation", icon: GitPullRequest },
  system: { label: "System", icon: Bell },
};

export function notificationTypeMeta(type?: string | null): NotificationTypeMeta {
  const key = String(type || "system");
  return typeMeta[key] || { label: titleCase(key), icon: Bell };
}

/* -------------------------------------------------------------------------- */
/*                                Time helpers                                */
/* -------------------------------------------------------------------------- */

/** Compact relative label for list rows ("5m", "3h", "Apr 12"). */
export function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const elapsedMs = Date.now() - date.getTime();

  if (elapsedMs < 60_000) {
    return "Just now";
  }

  if (elapsedMs < 7 * 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(isThisYear(date) ? {} : { year: "numeric" }),
  });
}

export function formatNotificationDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Groups notifications into Today / Yesterday / dated buckets, order preserved. */
export function groupNotificationsByDay(notifications: AppNotification[]) {
  const groups: Array<{ label: string; items: AppNotification[] }> = [];

  for (const notification of notifications) {
    const date = new Date(notification.created_at);
    const label = Number.isNaN(date.getTime())
      ? "Earlier"
      : isToday(date)
        ? "Today"
        : isYesterday(date)
          ? "Yesterday"
          : date.toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              ...(isThisYear(date) ? {} : { year: "numeric" }),
            });

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(notification);
    } else {
      groups.push({ label, items: [notification] });
    }
  }

  return groups;
}

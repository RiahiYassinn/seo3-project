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
  priority: "info" | "success" | "warning" | "critical" | string;
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
  async list(limit = 50) {
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

  async markAllRead() {
    const response = await api.post<NotificationsResponse>(
      "/notifications/read-all",
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

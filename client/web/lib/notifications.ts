import api from "@/lib/api";

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

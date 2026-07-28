import { create } from "zustand";
import {
  type AppNotification,
  notificationsAPI,
  subscribeToNotifications,
} from "@/lib/notifications";

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message || error?.message || fallback;

const sortByNewest = (notifications: AppNotification[]) =>
  notifications
    .slice()
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );

interface NotificationState {
  notifications: AppNotification[];
  loading: boolean;
  /** True only for the very first load, so refreshes never blank the list. */
  initialized: boolean;
  busyIds: string[];
  mutating: boolean;
  error: string;
  load: (options?: { silent?: boolean }) => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markUnread: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (notificationId: string) => Promise<void>;
  removeMany: (notificationIds: string[]) => Promise<void>;
  receive: (notification: AppNotification) => void;
  reset: () => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  loading: false,
  initialized: false,
  busyIds: [],
  mutating: false,
  error: "",

  load: async (options) => {
    if (!options?.silent) {
      set({ loading: true });
    }

    try {
      const data = await notificationsAPI.list();
      set({
        notifications: sortByNewest(data.notifications || []),
        error: "",
        initialized: true,
      });
    } catch (error: any) {
      set({ error: errorMessage(error, "Unable to load notifications") });
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (notificationId) => {
    const previous = get().notifications;
    const target = previous.find((item) => item.id === notificationId);
    if (!target || target.is_read) {
      return;
    }

    set({
      notifications: previous.map((item) =>
        item.id === notificationId
          ? { ...item, is_read: true, read_at: new Date().toISOString() }
          : item,
      ),
    });

    try {
      await notificationsAPI.markRead(notificationId);
    } catch (error: any) {
      set({
        notifications: previous,
        error: errorMessage(error, "Unable to update notification"),
      });
    }
  },

  markUnread: async (notificationId) => {
    const previous = get().notifications;
    const target = previous.find((item) => item.id === notificationId);
    if (!target || !target.is_read) {
      return;
    }

    set({
      notifications: previous.map((item) =>
        item.id === notificationId
          ? { ...item, is_read: false, read_at: null }
          : item,
      ),
    });

    try {
      await notificationsAPI.markUnread(notificationId);
    } catch (error: any) {
      set({
        notifications: previous,
        error: errorMessage(error, "Unable to update notification"),
      });
    }
  },

  markAllRead: async () => {
    const previous = get().notifications;
    if (!previous.some((item) => !item.is_read)) {
      return;
    }

    const readAt = new Date().toISOString();
    set({
      mutating: true,
      notifications: previous.map((item) =>
        item.is_read ? item : { ...item, is_read: true, read_at: readAt },
      ),
    });

    try {
      const data = await notificationsAPI.markAllRead();
      set({ notifications: sortByNewest(data.notifications || []), error: "" });
    } catch (error: any) {
      set({
        notifications: previous,
        error: errorMessage(error, "Unable to update notifications"),
      });
    } finally {
      set({ mutating: false });
    }
  },

  remove: async (notificationId) => {
    const previous = get().notifications;

    set({
      busyIds: [...get().busyIds, notificationId],
      notifications: previous.filter((item) => item.id !== notificationId),
    });

    try {
      await notificationsAPI.remove(notificationId);
    } catch (error: any) {
      set({
        notifications: previous,
        error: errorMessage(error, "Unable to delete notification"),
      });
    } finally {
      set({ busyIds: get().busyIds.filter((id) => id !== notificationId) });
    }
  },

  removeMany: async (notificationIds) => {
    if (notificationIds.length === 0) {
      return;
    }

    const previous = get().notifications;
    const removing = new Set(notificationIds);

    set({
      mutating: true,
      notifications: previous.filter((item) => !removing.has(item.id)),
    });

    try {
      const data = await notificationsAPI.removeMany(notificationIds);
      set({ notifications: sortByNewest(data.notifications || []), error: "" });
    } catch (error: any) {
      set({
        notifications: previous,
        error: errorMessage(error, "Unable to delete notifications"),
      });
    } finally {
      set({ mutating: false });
    }
  },

  receive: (notification) => {
    const current = get().notifications;
    if (current.some((item) => item.id === notification.id)) {
      return;
    }

    set({ notifications: sortByNewest([notification, ...current]) });
  },

  reset: () => set({ notifications: [], initialized: false, error: "" }),

  clearError: () => set({ error: "" }),
}));

export const selectUnreadCount = (state: NotificationState) =>
  state.notifications.reduce(
    (total, notification) => total + (notification.is_read ? 0 : 1),
    0,
  );

/**
 * Single SSE connection shared by every mounted consumer, plus a slow safety-net
 * refresh in case a push is missed during a reconnect window.
 */
let subscriberCount = 0;
let teardown: (() => void) | null = null;

export function connectNotificationStream(): () => void {
  subscriberCount += 1;

  if (subscriberCount === 1) {
    const unsubscribe = subscribeToNotifications((notification) =>
      useNotificationStore.getState().receive(notification),
    );
    const interval = window.setInterval(
      () => useNotificationStore.getState().load({ silent: true }),
      300000,
    );

    teardown = () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }

  return () => {
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0 && teardown) {
      teardown();
      teardown = null;
    }
  };
}

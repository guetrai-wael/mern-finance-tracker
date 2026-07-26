// Notification API service functions
import { api } from "../lib/api";
import type { Notification } from "../types";

export const getNotifications = async (
  unreadOnly = false
): Promise<{ notifications: Notification[]; unreadCount: number }> => {
  const response = await api.get(
    `/notifications${unreadOnly ? "?unread=true" : ""}`
  );
  return {
    notifications: response.data.data || [],
    unreadCount: response.data.meta?.unreadCount ?? 0,
  };
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await api.get("/notifications/unread-count");
  return response.data.data?.count ?? 0;
};

export const markNotificationRead = async (
  id: string
): Promise<{ notification: Notification }> => {
  const response = await api.patch(`/notifications/${id}/read`);
  return { notification: response.data.data };
};

export const markAllNotificationsRead = async (): Promise<{
  updated: number;
}> => {
  const response = await api.post("/notifications/read-all");
  return response.data.data;
};

export const deleteNotification = async (id: string): Promise<void> => {
  await api.delete(`/notifications/${id}`);
};

/** 通知状态 Store，管理系统通知列表的拉取与已读状态 */
import { create } from 'zustand';
import type { Notification } from '@/types';
import request from '@/api/request';

interface NotificationState {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (params?: { page?: number; pageSize?: number; is_read?: number }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (params) => {
    set({ loading: true });
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
    if (params?.is_read !== undefined) searchParams.append('is_read', String(params.is_read));

    try {
      const data = await request.get<{ list: Notification[]; total: number }>(`/notifications?${searchParams.toString()}`);
      set({ notifications: data.list, total: data.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = await request.get<{ count: number }>('/notifications/unread-count');
      set({ unreadCount: count });
    } catch {
      // ignore
    }
  },

  markAsRead: async (id) => {
    await request.patch(`/notifications/${id}/read`);
    const { notifications } = get();
    set({
      notifications: notifications.map(n => (n.id === id ? { ...n, is_read: 1 } : n)),
      unreadCount: Math.max(0, get().unreadCount - 1),
    });
  },

  markAllAsRead: async () => {
    await request.post('/notifications/read-all');
    const { notifications } = get();
    set({
      notifications: notifications.map(n => ({ ...n, is_read: 1 })),
      unreadCount: 0,
    });
  },
}));
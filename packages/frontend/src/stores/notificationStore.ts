import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  socket: Socket | null;

  setNotifications: (notifications: Notification[], unreadCount: number) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  socket: null,

  setNotifications: (notifications, unreadCount) =>
    set({ notifications, unreadCount }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  connectSocket: (token: string) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => console.log('Socket connected'));
    socket.on('disconnect', () => console.log('Socket disconnected'));

    // Real-time event handlers
    socket.on('match:new', (data: { listingId: string; matchCount: number; topScore: number }) => {
      get().addNotification({
        id: crypto.randomUUID(),
        type: 'match:new',
        title: 'New Match Found',
        message: `${data.matchCount} facility match(es) found for your listing. Top score: ${data.topScore.toFixed(1)}/100.`,
        read: false,
        data: data as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      });
    });

    socket.on('match:accepted', (data: { matchId: string; facilityName: string }) => {
      get().addNotification({
        id: crypto.randomUUID(),
        type: 'match:accepted',
        title: 'Match Accepted',
        message: `${data.facilityName} has accepted your waste listing. A pickup has been created.`,
        read: false,
        data: data as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      });
    });

    socket.on('pickup:status_update', (data: { pickupId: string; newStatus: string; timestamp: string }) => {
      const labels: Record<string, string> = {
        scheduled: 'Pickup Scheduled',
        in_transit: 'Pickup In Transit',
        delivered: 'Pickup Delivered',
        verified: 'Pickup Verified',
        cancelled: 'Pickup Cancelled',
      };
      get().addNotification({
        id: crypto.randomUUID(),
        type: 'pickup:status',
        title: labels[data.newStatus] || 'Pickup Update',
        message: `Pickup status updated to: ${data.newStatus.replace(/_/g, ' ')}.`,
        read: false,
        data: data as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));

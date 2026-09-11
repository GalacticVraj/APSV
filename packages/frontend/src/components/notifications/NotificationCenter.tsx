import React, { useEffect } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNotificationStore } from '../../stores/notificationStore';
import apiClient from '../../api/client';

interface Props {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: Props) {
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore();

  useEffect(() => {
    apiClient.get('/api/notifications?limit=20')
      .then((r) => {
        setNotifications(r.data.notifications, r.data.unread_count);
      })
      .catch(() => {});
  }, []);

  const handleMarkRead = async (id: string) => {
    markRead(id);
    apiClient.post(`/api/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAll = async () => {
    markAllRead();
    apiClient.post('/api/notifications/read-all').catch(() => {});
  };

  const typeIcon: Record<string, string> = {
    'match:new': '✅',
    'match:accepted': '🤝',
    'pickup:status': '🚛',
    default: '🔔',
  };

  return (
    <div className="w-80 bg-white rounded-2xl border border-charcoal-200 shadow-panel overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-charcoal-100">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-charcoal-700" />
          <span className="text-sm font-bold text-charcoal-900">Notifications</span>
          {unreadCount > 0 && (
            <span className="badge-green text-[10px] px-2 py-0.5">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              className="text-xs text-forest-700 hover:text-forest-900 font-medium flex items-center gap-1"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onClose} className="text-charcoal-400 hover:text-charcoal-700 p-1 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell className="w-8 h-8 text-charcoal-300 mx-auto mb-2" />
            <p className="text-sm text-charcoal-400">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-charcoal-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`px-4 py-3 flex items-start gap-3 hover:bg-charcoal-50 transition-colors cursor-pointer ${
                  !notif.read ? 'bg-forest-50/50' : ''
                }`}
                onClick={() => handleMarkRead(notif.id)}
              >
                <span className="text-lg flex-shrink-0 mt-0.5">
                  {typeIcon[notif.type] || typeIcon.default}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold text-charcoal-900 mb-0.5 ${!notif.read ? 'text-forest-900' : ''}`}>
                    {notif.title}
                  </p>
                  <p className="text-xs text-charcoal-500 leading-relaxed line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-charcoal-400 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-forest-500 flex-shrink-0 mt-1.5" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { Bell, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { NOTIFICATION_TYPE_META } from '@/types/notifications';
import type { Notification, NotificationsResponse } from '@/types/notifications';
import SendNotificationModal from './SendNotificationModal';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Hozir';
  if (m < 60) return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

export default function NotificationBell() {
  const qc   = useQueryClient();
  const user = useAuthStore(s => s.user);
  const isSA = user?.role === 'super_admin';

  const [open,     setOpen]     = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get<NotificationsResponse>('/notifications?limit=15').then(r => r.data),
    refetchInterval: 30_000,
  });

  const items       = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // Tashqariga bosilganda panelni yopish
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMut = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function handleItemClick(n: Notification) {
    if (!n.isRead) markReadMut.mutate(n.id);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Sarlavha */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Bildirishnomalar</h3>
            <div className="flex items-center gap-1">
              {isSA && (
                <button
                  onClick={() => setSendOpen(true)}
                  title="Yangi bildirishnoma yuborish"
                  className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition"
                ><Plus size={14} /></button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMut.mutate()}
                  disabled={markAllReadMut.isPending}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  Hammasini o'qildi
                </button>
              )}
            </div>
          </div>

          {/* Ro'yxat */}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell size={28} className="mb-2" />
                <p className="text-sm">Bildirishnomalar yo'q</p>
              </div>
            ) : (
              items.map(n => {
                const meta = NOTIFICATION_TYPE_META[n.type];
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors ${
                      !n.isRead ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                      <meta.icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                        <p className="text-xs font-semibold text-gray-900 truncate">{n.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <SendNotificationModal open={sendOpen} onClose={() => setSendOpen(false)} />
    </div>
  );
}

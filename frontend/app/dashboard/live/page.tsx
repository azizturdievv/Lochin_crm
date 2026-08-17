'use client';

import { AlertTriangle, Calendar, Radio, User, Video } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/auth.store';
import { LIVE_SESSION_STATUS_META } from '@/types/live-sessions';
import type { LiveSession } from '@/types/live-sessions';
import ScheduleLiveSessionModal from '@/components/live/ScheduleLiveSessionModal';

export default function LiveSessionsPage() {
  const router = useRouter();
  const user   = useAuthStore(s => s.user);
  const role   = user?.role ?? 'student';
  const canManage = role === 'super_admin' || role === 'manager' || role === 'ustoz';

  const [createOpen, setCreateOpen] = useState(false);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['live-sessions'],
    queryFn:  () => api.get<LiveSession[]>('/live-sessions').then(r => r.data),
    refetchInterval: 30_000,
  });

  const { data: config } = useQuery({
    queryKey: ['live-sessions-config'],
    queryFn:  () => api.get<{ configured: boolean }>('/live-sessions/config/status').then(r => r.data),
  });

  const live      = sessions.filter(s => s.status === 'live');
  const scheduled = sessions.filter(s => s.status === 'scheduled');
  const ended     = sessions.filter(s => s.status === 'ended' || s.status === 'cancelled');
  const ordered   = [...live, ...scheduled, ...ended];

  return (
    <div className="space-y-5">
      {/* SARLAVHA */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white shrink-0"><Video size={18} /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Jonli efir</h1>
            <p className="text-xs text-gray-400">{sessions.length} ta dars</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            + Yangi dars
          </button>
        )}
      </div>

      {/* KONFIGURATSIYA OGOHLANTIRISHI */}
      {config && !config.configured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Video xizmati hali sozlanmagan</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Darslarni rejalashtirish mumkin, lekin qo'shilish uchun Super Admin backend'ga Livekit API kalitlarini qo'shishi kerak.
            </p>
          </div>
        </div>
      )}

      {/* RO'YXAT */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
          <Video size={40} />
          <p className="text-sm font-medium text-gray-500">Darslar topilmadi</p>
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
            >
              + Birinchi darsni rejalashtirish
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ordered.map(s => (
            <SessionCard
              key={s.id}
              session={s}
              isHost={s.hostId === user?.id}
              canManage={canManage}
              onOpen={() => router.push(`/dashboard/live/${s.id}`)}
            />
          ))}
        </div>
      )}

      {createOpen && <ScheduleLiveSessionModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function SessionCard({ session, isHost, canManage, onOpen }: {
  session: LiveSession; isHost: boolean; canManage: boolean; onOpen: () => void;
}) {
  const statusMeta = LIVE_SESSION_STATUS_META[session.status];
  const canJoin = session.status === 'live' || (session.status === 'scheduled' && (isHost || canManage));
  const isEnded = session.status === 'ended' || session.status === 'cancelled';

  return (
    <div className={`bg-white border rounded-2xl p-4 space-y-3 transition-colors ${
      session.status === 'live' ? 'border-red-200 bg-red-50/20' : 'border-gray-100'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm min-w-0 truncate">{session.title}</h3>
        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
          {session.status === 'live' && <Radio size={10} className="animate-pulse" />}
          {statusMeta.label}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-500">
        {session.group && <p className="truncate">{session.group.name}</p>}
        <p className="flex items-center gap-1.5">
          <Calendar size={12} className="shrink-0" />
          {formatDateTime(session.scheduledAt)}
        </p>
        {session.host && (
          <p className="flex items-center gap-1.5">
            <User size={12} className="shrink-0" />
            {session.host.firstName} {session.host.lastName}
          </p>
        )}
      </div>

      <button
        onClick={onOpen}
        disabled={isEnded}
        className={`w-full py-2 text-sm font-medium rounded-xl transition-colors ${
          isEnded
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : session.status === 'live'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : canJoin
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {isEnded ? 'Yakunlangan' : session.status === 'live' ? "Qo'shilish" : isHost ? 'Boshlash' : 'Kutilmoqda'}
      </button>
    </div>
  );
}

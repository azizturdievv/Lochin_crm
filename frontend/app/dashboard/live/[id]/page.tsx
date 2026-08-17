'use client';

import { AlertTriangle, Calendar, ChevronLeft, LogIn, User, Video } from 'lucide-react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import { useAuthStore } from '@/store/auth.store';
import { LIVE_SESSION_STATUS_META } from '@/types/live-sessions';
import type { LiveSession, JoinLiveSessionResponse } from '@/types/live-sessions';

const LiveVideoRoom = dynamic(() => import('@/components/live/LiveVideoRoom'), {
  ssr: false,
  loading: () => <div className="h-[80vh] min-h-[420px] rounded-2xl bg-gray-100 animate-pulse" />,
});

export default function LiveSessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();
  const user   = useAuthStore(s => s.user);

  const [joinData, setJoinData] = useState<{ token: string; url: string } | null>(null);
  const [joinError, setJoinError] = useState('');

  const { data: session, isLoading } = useQuery({
    queryKey: ['live-session', params.id],
    queryFn:  () => api.get<LiveSession>(`/live-sessions/${params.id}`).then(r => r.data),
  });

  const joinMut = useMutation({
    mutationFn: () => api.post<JoinLiveSessionResponse>(`/live-sessions/${params.id}/join`).then(r => r.data),
    onSuccess: (data) => {
      setJoinData({ token: data.token, url: data.url });
      qc.invalidateQueries({ queryKey: ['live-session', params.id] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setJoinError(e.response?.data?.message ?? "Qo'shilishda xatolik yuz berdi"),
  });

  const endMut = useMutation({
    mutationFn: () => api.post(`/live-sessions/${params.id}/end`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-sessions'] });
      router.push('/dashboard/live');
    },
  });

  if (isLoading || !session) {
    return <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />;
  }

  const isHost   = session.hostId === user?.id;
  const isStaff  = user?.role === 'super_admin' || user?.role === 'manager';
  const canEnd   = isHost || isStaff;
  const statusMeta = LIVE_SESSION_STATUS_META[session.status];

  return (
    <div className="space-y-4">
      {/* SARLAVHA */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={() => router.push('/dashboard/live')}
            className="shrink-0 -ml-1 mt-0.5 text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 truncate">{session.title}</h2>
              <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
                {statusMeta.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
              {session.group && <span className="truncate">{session.group.name}</span>}
              <span className="flex items-center gap-1"><Calendar size={12} />
                {formatDateTime(session.scheduledAt)}
              </span>
              {session.host && (
                <span className="flex items-center gap-1"><User size={12} />{session.host.firstName} {session.host.lastName}</span>
              )}
            </div>
          </div>
        </div>

        {canEnd && session.status !== 'ended' && session.status !== 'cancelled' && (
          <button
            onClick={() => endMut.mutate()}
            disabled={endMut.isPending}
            className="shrink-0 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {endMut.isPending ? 'Yakunlanmoqda...' : 'Darsni yakunlash'}
          </button>
        )}
      </div>

      {/* KONTENT */}
      {joinData ? (
        <LiveVideoRoom
          token={joinData.token}
          url={joinData.url}
          onLeave={() => { setJoinData(null); router.push('/dashboard/live'); }}
        />
      ) : session.status === 'ended' || session.status === 'cancelled' ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2 bg-gray-50 rounded-2xl">
          <Video size={36} />
          <p className="text-sm font-medium text-gray-500">Bu dars yakunlangan</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-gray-50 rounded-2xl px-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600">
            <Video size={28} />
          </div>
          <button
            onClick={() => { setJoinError(''); joinMut.mutate(); }}
            disabled={joinMut.isPending}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <LogIn size={16} />
            {joinMut.isPending ? "Ulanmoqda..." : session.status === 'live' ? "Darsga qo'shilish" : isHost ? 'Darsni boshlash' : "Qo'shilish"}
          </button>
          {joinError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2 rounded-xl max-w-md text-center">
              <AlertTriangle size={14} className="shrink-0" />
              {joinError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

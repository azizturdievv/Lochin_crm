'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LeaderboardResponse } from '@/types/events';

interface Props {
  eventId: string;
  live:    boolean; // musobaqa davom etayotgan bo'lsa avtomatik yangilanadi
}

const RANK_STYLE = (rank: number | null) =>
  rank === 1 ? 'bg-amber-100 text-amber-700'
  : rank === 2 ? 'bg-gray-200 text-gray-700'
  : rank === 3 ? 'bg-orange-100 text-orange-700'
  : 'bg-gray-50 text-gray-400';

export default function LeaderboardPanel({ eventId, live }: Props) {
  const { data, isLoading } = useQuery({
    queryKey:        ['competition-leaderboard', eventId],
    queryFn:         () => api.get<LeaderboardResponse>(`/events/${eventId}/competition/leaderboard`).then(r => r.data),
    refetchInterval: live ? 5000 : false,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.participants.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-6">Hali ishtirokchi yo'q</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{data.totalSubmitted} / {data.totalRegistered} topshirdi</span>
        {live && (
          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Jonli
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {data.participants.map(p => (
          <div
            key={p.participantId}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
              p.rank && p.rank <= 3 ? 'border-amber-100 bg-amber-50/40' : 'border-gray-100 bg-white'
            }`}
          >
            <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${RANK_STYLE(p.rank)}`}>
              {p.rank ?? '–'}
            </div>
            <span className="flex-1 min-w-0 text-sm font-medium text-gray-900 truncate">{p.studentName}</span>
            <span className="shrink-0 text-sm font-semibold text-gray-700">
              {p.score !== null ? `${p.score} ball` : 'kutilmoqda'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

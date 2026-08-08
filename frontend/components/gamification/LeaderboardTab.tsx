'use client';

import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LeaderboardEntry } from '@/types/gamification';

type Period = 'monthly' | 'all';
type FilterRole = 'all' | 'student' | 'ustoz' | 'manager';

const ROLE_LABELS: Record<string, string> = {
  student:     "O'quvchilar",
  ustoz:       'Ustozlar',
  manager:     'Xodimlar',
  super_admin: 'Super Admin',
};

const PODIUM_COLOR = ['bg-amber-400', 'bg-gray-300', 'bg-amber-600'];
const PODIUM_SIZE  = ['h-24', 'h-20', 'h-16'];

export default function LeaderboardTab() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [role,   setRole]   = useState<FilterRole>('all');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period, role],
    queryFn:  () => api.get<LeaderboardEntry[]>('/gamification/leaderboard', {
      params: { period, role, limit: 50 },
    }).then(r => r.data),
  });

  const top3  = entries.slice(0, 3);
  const rest  = entries.slice(3);

  // Podium tartib: 2-o'rin chap, 1-o'rin o'rta, 3-o'rin o'ng
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  return (
    <div className="space-y-6">
      {/* Filtr */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['monthly', 'all'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {p === 'monthly' ? 'Bu oy' : 'Jami'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'student', 'ustoz', 'manager'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                role === r
                  ? 'bg-primary-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {r === 'all' ? 'Barchasi' : ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl"><Trophy size={36} /></div>
          <p className="text-sm">Ma'lumot topilmadi</p>
        </div>
      ) : (
        <>
          {/* ─── Podium (Top 3) ─── */}
          {top3.length === 3 && (
            <div className="bg-gradient-to-b from-amber-50 to-white rounded-3xl p-6">
              <h3 className="text-center text-sm font-semibold text-amber-700 mb-6">Top 3</h3>
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map((entry, i) => {
                  const isFirst  = entry.rank === 1;
                  const podiumI  = [1, 0, 2][i]; // 2nd, 1st, 3rd
                  return (
                    <div key={entry.userId} className="flex flex-col items-center gap-2 min-w-0">
                      {/* Toj (1-o'rin uchun) */}
                      {isFirst && <div className="text-2xl"></div>}

                      {/* Avatar */}
                      <div className={`rounded-full border-4 flex items-center justify-center text-sm font-bold text-white ${
                        PODIUM_COLOR[podiumI]
                      } ${isFirst ? 'w-16 h-16 border-amber-300' : 'w-12 h-12 border-gray-200'}`}>
                        {entry.avatarUrl
                          ? <img src={entry.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          : `${entry.firstName[0]}${entry.lastName[0]}`
                        }
                      </div>

                      {/* Ism */}
                      <div className="text-center">
                        <p className={`font-semibold text-gray-900 ${isFirst ? 'text-sm' : 'text-xs'} truncate max-w-[80px]`}>
                          {entry.firstName}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[80px]">
                          {entry.lastName}
                        </p>
                      </div>

                      {/* Poydevor */}
                      <div className={`w-20 ${PODIUM_SIZE[podiumI]} ${PODIUM_COLOR[podiumI]} rounded-t-xl flex flex-col items-center justify-start pt-2 gap-0.5`}>
                        <span className="text-white font-black text-lg">{entry.rank}</span>
                        <span className="text-white/80 text-[10px] font-medium">
                          {period === 'monthly' ? entry.thisMonthPoints : entry.totalPoints}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Jadval ─── */}
          <div className="space-y-1.5">
            {(top3.length === 3 ? rest : entries).map(entry => (
              <div
                key={entry.userId}
                className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:border-gray-200 transition-colors"
              >
                {/* Rank */}
                <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  entry.rank <= 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {entry.rank}
                </div>

                {/* Avatar */}
                <div className="shrink-0 w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 overflow-hidden">
                  {entry.avatarUrl
                    ? <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : `${entry.firstName[0]}${entry.lastName[0]}`
                  }
                </div>

                {/* Ism */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {entry.firstName} {entry.lastName}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {ROLE_LABELS[entry.role] ?? entry.role}
                    {entry.streak > 1 && ` · ${entry.streak} kun`}
                  </p>
                </div>

                {/* Badge'lar */}
                {entry.badgeCount > 0 && (
                  <div className="shrink-0 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    {entry.badgeCount}
                  </div>
                )}

                {/* Ballar */}
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold text-gray-900">
                    {period === 'monthly' ? entry.thisMonthPoints : entry.totalPoints}
                  </div>
                  <div className="text-[10px] text-gray-400">ball</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

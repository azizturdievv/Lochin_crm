'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import LeaderboardTab from '@/components/gamification/LeaderboardTab';
import PointsTab      from '@/components/gamification/PointsTab';
import BookclubTab    from '@/components/gamification/BookclubTab';
import VocabTab       from '@/components/gamification/VocabTab';

type Tab = 'leaderboard' | 'points' | 'bookclub' | 'vocab';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'leaderboard', label: 'Reyting',      icon: '🏆' },
  { id: 'points',      label: 'Mening ballim', icon: '⭐' },
  { id: 'bookclub',    label: 'Kitobxonlik',   icon: '📖' },
  { id: 'vocab',       label: "Lug'at",        icon: '📚' },
];

export default function GamificationPage() {
  const user  = useAuthStore(s => s.user);
  const role  = user?.role ?? 'student';
  const [tab, setTab] = useState<Tab>('leaderboard');

  const canAdd = role === 'super_admin';

  // Foydalanuvchi umumiy stat
  const { data: myStats } = useQuery({
    queryKey: ['my-gamification-stats', user?.id],
    queryFn:  () => api.get('/gamification/my-stats').then(r => r.data) as Promise<{
      totalPoints: number; rank: number; streak: number; badgeCount: number;
    }>,
    enabled: !!user,
  });

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-4 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white text-xl shrink-0">
            🏆
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Rag'bat va Ball tizimi</h1>
            <p className="text-xs text-gray-400">Raqobat, o'sish va motivatsiya</p>
          </div>

          {/* Mening stat pills */}
          {myStats && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                <span className="text-amber-700 font-bold text-sm">{myStats.totalPoints}</span>
                <span className="text-amber-600 text-xs">⭐</span>
              </div>
              {myStats.rank > 0 && (
                <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5">
                  <span className="text-purple-700 font-bold text-sm">#{myStats.rank}</span>
                </div>
              )}
              {myStats.streak > 1 && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
                  <span className="text-orange-700 font-bold text-sm">🔥 {myStats.streak}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab navigatsiya */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'points'      && <PointsTab userId={user?.id} />}
        {tab === 'bookclub'    && <BookclubTab canAdd={canAdd} />}
        {tab === 'vocab'       && <VocabTab canAdd={role !== 'student'} />}
      </div>
    </div>
  );
}

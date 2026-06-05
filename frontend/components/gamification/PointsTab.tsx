'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { POINT_REASON_META } from '@/types/gamification';
import type { PointLog, Badge } from '@/types/gamification';
import { useAuthStore } from '@/store/auth.store';

interface Props {
  userId?: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m} daqiqa oldin`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

export default function PointsTab({ userId }: Props) {
  const me = useAuthStore(s => s.user);
  const id = userId ?? me?.id;

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['point-logs', id],
    queryFn:  () => api.get<PointLog[]>('/gamification/points/history', {
      params: { userId: id, limit: 50 },
    }).then(r => r.data),
    enabled: !!id,
  });

  const { data: badges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ['badges', id],
    queryFn:  () => api.get<Badge[]>('/gamification/badges', {
      params: { userId: id },
    }).then(r => r.data),
    enabled: !!id,
  });

  const totalPoints   = logs.reduce((s, l) => s + l.points, 0);
  const earnedBadges  = badges.filter(b => b.isEarned);
  const lockedBadges  = badges.filter(b => !b.isEarned);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-amber-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700">{totalPoints}</div>
          <div className="text-xs text-amber-600 mt-0.5">Jami ball ⭐</div>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{earnedBadges.length}</div>
          <div className="text-xs text-emerald-600 mt-0.5">Badge 🏅</div>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{logs.length}</div>
          <div className="text-xs text-blue-600 mt-0.5">Amal 📊</div>
        </div>
      </div>

      {/* ─── Badge'lar ─── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">🏅 Badge'lar</h3>
        {badgesLoading ? (
          <div className="flex gap-3 flex-wrap">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="w-16 h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : badges.length === 0 ? (
          <p className="text-sm text-gray-400">Hali badge'lar yo'q</p>
        ) : (
          <div className="space-y-4">
            {/* Olingan */}
            {earnedBadges.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Olingan ({earnedBadges.length})</p>
                <div className="flex flex-wrap gap-3">
                  {earnedBadges.map(b => (
                    <div
                      key={b.id}
                      className="flex flex-col items-center gap-1 bg-amber-50 border border-amber-200 rounded-2xl p-3 w-20 text-center"
                      title={b.description}
                    >
                      <span className="text-2xl">{b.icon}</span>
                      <span className="text-[10px] font-medium text-amber-700 leading-tight">{b.name}</span>
                      {b.earnedAt && (
                        <span className="text-[9px] text-gray-400">
                          {new Date(b.earnedAt).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Qulflangan */}
            {lockedBadges.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Qulflangan ({lockedBadges.length})</p>
                <div className="flex flex-wrap gap-3">
                  {lockedBadges.map(b => (
                    <div
                      key={b.id}
                      className="flex flex-col items-center gap-1 bg-gray-50 border border-gray-200 rounded-2xl p-3 w-20 text-center opacity-60"
                      title={b.condition}
                    >
                      <span className="text-2xl grayscale">{b.icon}</span>
                      <span className="text-[10px] font-medium text-gray-500 leading-tight">{b.name}</span>
                      <span className="text-[9px] text-gray-400">🔒</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Ball tarixi ─── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 Ball tarixi</h3>
        {logsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400">Hali ball tarixi yo'q</p>
        ) : (
          <div className="space-y-1.5">
            {logs.map(log => {
              const meta = POINT_REASON_META[log.reasonType] ?? {
                label: log.reason, icon: '⭐', sign: '+',
              };
              const isPositive = log.points > 0;
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
                >
                  <span className="text-xl shrink-0">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{log.reason}</p>
                    <p className="text-[10px] text-gray-400">{relTime(log.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 font-bold text-sm px-2 py-0.5 rounded-lg ${
                    isPositive
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-red-600 bg-red-50'
                  }`}>
                    {isPositive ? '+' : ''}{log.points} ⭐
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

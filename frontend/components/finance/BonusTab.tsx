'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { fmtM } from '@/types/finance';
import type { QuarterBonus } from '@/types/finance';

interface Props { month: string }

function getCurrentQuarter(month: string): { year: string; quarter: number } {
  const [y, m] = month.split('-').map(Number);
  return { year: String(y), quarter: Math.ceil(m / 3) };
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const ROLE_LABEL: Record<string, string> = { ustoz: 'Ustoz', manager: 'Manager', super_admin: 'SA' };

export default function BonusTab({ month }: Props) {
  const { year, quarter } = getCurrentQuarter(month);

  const { data, isLoading } = useQuery({
    queryKey: ['quarterly-bonus', year, quarter],
    queryFn:  () => api.get<QuarterBonus>('/finance/quarterly-bonus', { params: { month } }).then(r => r.data),
  });

  const topThree = (data?.staff ?? []).slice(0, 3);
  const rest     = (data?.staff ?? []).slice(3);

  return (
    <div className="space-y-6">

      {/* Chorak info */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-xl p-4">
          <p className="text-xs text-purple-600 mb-1">Chorak</p>
          <p className="text-lg font-bold text-purple-800">{year} Q{quarter}</p>
          <p className="text-xs text-purple-500 mt-1">{data?.period.join(' – ')}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-xs text-emerald-600 mb-1">Koeffitsient</p>
          <p className="text-lg font-bold text-emerald-800">{data?.coefficientPerPoint ?? 0} so'm/ball</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-xs text-amber-600 mb-1">Jami fond</p>
          <p className="text-lg font-bold text-amber-800">{fmtM(data?.totalBonusFund ?? 0)} so'm</p>
        </div>
      </div>

      {/* Top 3 podium */}
      {!isLoading && topThree.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-5">🏆 Top xodimlar</h3>
          <div className="flex items-end justify-center gap-4">
            {/* 2-o'rin */}
            {topThree[1] && (
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="text-3xl">🥈</div>
                <div className="w-full bg-gray-100 rounded-t-xl p-3 text-center" style={{ height: '80px' }}>
                  <p className="text-xs font-semibold text-gray-700 truncate">{topThree[1].name}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{fmtM(topThree[1].bonusAmount)}</p>
                  <p className="text-xs text-gray-400">{topThree[1].totalPoints} ball</p>
                </div>
              </div>
            )}
            {/* 1-o'rin */}
            {topThree[0] && (
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="text-4xl">🥇</div>
                <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-t-xl p-3 text-center" style={{ height: '100px' }}>
                  <p className="text-xs font-semibold text-amber-800 truncate">{topThree[0].name}</p>
                  <p className="text-base font-bold text-amber-900 mt-1">{fmtM(topThree[0].bonusAmount)}</p>
                  <p className="text-xs text-amber-600">{topThree[0].totalPoints} ball</p>
                </div>
              </div>
            )}
            {/* 3-o'rin */}
            {topThree[2] && (
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className="text-3xl">🥉</div>
                <div className="w-full bg-orange-50 rounded-t-xl p-3 text-center" style={{ height: '65px' }}>
                  <p className="text-xs font-semibold text-orange-700 truncate">{topThree[2].name}</p>
                  <p className="text-sm font-bold text-orange-900 mt-1">{fmtM(topThree[2].bonusAmount)}</p>
                  <p className="text-xs text-orange-400">{topThree[2].totalPoints} ball</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* To'liq jadval */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-12">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Xodim</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ball</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Koef.</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Mukofot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : !data?.staff?.length
                ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                        <div className="text-5xl mb-3">📊</div>
                        <p>Ma'lumot topilmadi</p>
                      </td>
                    </tr>
                  )
                : (data?.staff ?? []).map(s => (
                    <tr key={s.userId}
                      className={`hover:bg-gray-50/60 transition-colors ${s.rank <= 3 ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-lg">
                          {MEDAL[s.rank] ?? <span className="text-gray-400 text-sm font-medium">{s.rank}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <span className="text-xs text-gray-400">{ROLE_LABEL[s.role] ?? s.role}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-semibold text-amber-700">⭐ {s.totalPoints}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-gray-500 hidden sm:table-cell text-xs">
                        {data?.coefficientPerPoint} so'm/ball
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                        {fmtM(s.bonusAmount)} so'm
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

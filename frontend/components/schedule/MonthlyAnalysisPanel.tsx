'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AnalysisData } from '@/types/schedule';

const FILL_COLOR = (pct: number) =>
  pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f87171';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthlyAnalysisPanel() {
  const [month, setMonth] = useState(currentMonth);

  const { data, isLoading } = useQuery({
    queryKey: ['schedule-analysis', month],
    queryFn: () => api.get<AnalysisData>('/schedule/analysis', { params: { month } }).then(r => r.data),
  });

  const groupFillSorted = [...(data?.groupFill ?? [])].sort((a, b) => a.fillPercent - b.fillPercent);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Oylik tahlil</h3>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Fan bo'yicha daromad */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              Fan bo'yicha daromad
            </h4>
            {!data?.subjectRevenue.length ? (
              <p className="text-xs text-gray-400">Bu oy uchun ma'lumot yo'q</p>
            ) : (
              <div className="space-y-2.5">
                {data.subjectRevenue.map(s => (
                  <div key={s.subject} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{s.subject}</p>
                      <p className="text-[10px] text-gray-400">{s.students} o'quvchi</p>
                    </div>
                    <p className="text-xs font-bold text-emerald-700 shrink-0">
                      {(s.revenue / 1_000_000).toFixed(1)}M
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* O'qituvchi ish yuki */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              O'qituvchi ish yuki
            </h4>
            {!data?.teacherStats.length ? (
              <p className="text-xs text-gray-400">Bu oy uchun ma'lumot yo'q</p>
            ) : (
              <div className="space-y-2.5">
                {data.teacherStats.map(t => (
                  <div key={t.name} className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700 truncate">{t.name}</p>
                    <p className="text-[10px] text-gray-400 shrink-0">
                      {t.totalHours}h · {t.lessonCount} dars · {t.groupCount} guruh
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guruh to'ldirilganlik */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
              Guruh to'ldirilganlik
            </h4>
            {!groupFillSorted.length ? (
              <p className="text-xs text-gray-400">Faol guruh yo'q</p>
            ) : (
              <div className="space-y-2.5">
                {groupFillSorted.map(g => (
                  <div key={g.name}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-medium text-gray-600 truncate">{g.name}</p>
                      <p className="text-[10px] text-gray-400 shrink-0">
                        {g.currentStudents}/{g.maxStudents}
                      </p>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${g.fillPercent}%`, backgroundColor: FILL_COLOR(g.fillPercent) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

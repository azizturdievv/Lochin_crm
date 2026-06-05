'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeekScheduleResponse } from '@/types/schedule';

interface Props {
  summary: WeekScheduleResponse['summary'];
  freeSlotCount?: number;
  avgMonthlyFee?: number;
}

const UTILIZATION_COLOR = (pct: number) =>
  pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#f87171';

export default function AnalysisPanel({ summary, freeSlotCount, avgMonthlyFee = 450_000 }: Props) {
  const potentialRevenue = (freeSlotCount ?? summary.freeSlots) * avgMonthlyFee;

  const chartData = summary.roomUsage.map(r => ({
    name:        `X${r.room}`,
    utilization: r.utilization,
    hours:       r.bookedHours,
    capacity:    r.capacity,
  }));

  return (
    <div className="space-y-4">

      {/* Bo'sh slotlar */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{summary.freeSlots}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Bo'sh slot (hafta)</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{summary.totalLessons}</p>
          <p className="text-xs text-blue-600 mt-0.5">Jami dars</p>
        </div>
      </div>

      {/* Daromad imkoniyati */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-medium text-amber-700 mb-1">💰 Daromad imkoniyati</p>
        <p className="text-lg font-bold text-amber-900">
          {(potentialRevenue / 1_000_000).toFixed(1)}M so'm
        </p>
        <p className="text-xs text-amber-600 mt-0.5">
          {summary.freeSlots} bo'sh slot × {(avgMonthlyFee / 1000).toFixed(0)}K so'm
        </p>
      </div>

      {/* Xona bandligi bar chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          Xona bandligi (%)
        </h4>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={chartData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => [name === 'utilization' ? `${v}%` : `${v}h`, name === 'utilization' ? 'Bandlik' : 'Soat']}
              contentStyle={{ borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Bar
              dataKey="utilization"
              radius={[6, 6, 0, 0]}
              fill="#10b981"
              label={{ position: 'top', fontSize: 10, formatter: (v: unknown) => `${v}%` }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Xona detallari */}
      <div className="space-y-2">
        {summary.roomUsage.map(r => (
          <div key={r.room} className="flex items-center gap-3">
            <div className="w-12 text-xs font-medium text-gray-600 shrink-0">X{r.room}</div>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${r.utilization}%`, backgroundColor: UTILIZATION_COLOR(r.utilization) }}
              />
            </div>
            <div className="text-xs text-gray-400 shrink-0 w-16 text-right">
              {r.bookedHours}h / {r.capacity} o'rin
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

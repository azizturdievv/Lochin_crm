'use client';

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { STATUS_META, STATUS_COLORS } from '@/types/attendance';
import type { LessonAttendance } from '@/types/attendance';

interface Props {
  lessonData: LessonAttendance;
  weeklyData?: Array<{ date: string; rate: number; present: number; total: number }>;
}

export default function AttendanceStats({ lessonData, weeklyData }: Props) {
  const { stats } = lessonData;

  const pieData = (Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
    .map(s => ({
      name:  STATUS_META[s].label,
      value: s === 'present' ? stats.present
           : s === 'late'    ? stats.late
           : s === 'absent'  ? stats.absent
           : s === 'excused' ? stats.excused
           : stats.unexcused,
      color: STATUS_COLORS[s],
      status: s,
    }))
    .filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Foiz karta */}
      <div className="grid grid-cols-3 gap-3">
        <StatMini
          label="Davomat"
          value={`${stats.rate}%`}
          color={stats.rate >= 80 ? 'emerald' : stats.rate >= 60 ? 'amber' : 'red'}
        />
        <StatMini label="Kelganlar"    value={`${stats.present + stats.late}`} color="blue"   />
        <StatMini label="Kelmadi"      value={`${stats.absent + stats.unexcused}`} color="red" />
      </div>

      {/* Doira diagramma */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Taqsimlash</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} strokeWidth={0} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} ta`, name]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
              />
              <Legend
                formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Raqamli xulosa */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(s => {
              const meta = STATUS_META[s];
              const cnt  = s === 'present' ? stats.present
                         : s === 'late'    ? stats.late
                         : s === 'absent'  ? stats.absent
                         : s === 'excused' ? stats.excused
                         : stats.unexcused;
              if (cnt === 0) return null;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className="text-xs text-gray-500">{meta.label}:</span>
                  <span className="text-xs font-semibold text-gray-900 ml-auto">{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Haftalik trend */}
      {weeklyData && weeklyData.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">7 kunlik davomat %</h4>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={weeklyData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Davomat']}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="rate" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  const clsMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    red:     'bg-red-50 text-red-700',
    blue:    'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`${clsMap[color] ?? 'bg-gray-50 text-gray-700'} rounded-xl p-3 text-center`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-70 mt-0.5">{label}</p>
    </div>
  );
}

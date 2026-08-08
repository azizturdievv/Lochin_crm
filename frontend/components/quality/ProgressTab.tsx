'use client';

import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import api from '@/lib/api';
import type { ProgressSnapshot } from '@/types/quality';

interface Props {
  userId?:   string;
  userName?: string;
}

interface ProgressData {
  baseline:  number | null;
  snapshots: ProgressSnapshot[];
  subjects:  string[];
}

// O'zbekcha sana formati
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' });
}

const SUBJECT_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ef4444', '#06b6d4', '#f97316', '#6366f1',
];

export default function ProgressTab({ userId, userName }: Props) {
  const { data, isLoading } = useQuery<ProgressData>({
    queryKey: ['progress-snapshots', userId],
    queryFn:  () => api.get('/quality/progress', {
      params: { userId },
    }).then(r => r.data),
    enabled: !!userId,
  });

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <div className="text-4xl"><BarChart3 size={36} /></div>
        <p className="text-sm">O'quvchi tanlanmagan</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.snapshots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <div className="text-4xl"><TrendingUp size={36} /></div>
        <p className="text-sm">Progress ma'lumotlari hali yo'q</p>
        <p className="text-xs text-gray-300">Testlar topshirilgach ma'lumot paydo bo'ladi</p>
      </div>
    );
  }

  // Chart uchun ma'lumot tayyorlash
  // Sana bo'yicha guruhlanadi, har bir fan alohida qator
  const dateMap = new Map<string, Record<string, number>>();
  data.snapshots.forEach(s => {
    const d = s.date.slice(0, 10);
    if (!dateMap.has(d)) dateMap.set(d, {});
    dateMap.get(d)![s.subjectName] = s.score;
  });

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, scores]) => ({ date: shortDate(date), ...scores }));

  // Baseline (ilk qabul) nuqtasi
  const baseline = data.baseline;

  // Oxirgi natijalar
  const latestBySubject = new Map<string, ProgressSnapshot>();
  [...data.snapshots].reverse().forEach(s => {
    if (!latestBySubject.has(s.subjectName)) latestBySubject.set(s.subjectName, s);
  });

  // O'rtacha o'sish
  const avgNow = data.snapshots.length > 0
    ? Array.from(latestBySubject.values()).reduce((s, x) => s + x.score, 0) / latestBySubject.size
    : 0;
  const improvement = baseline != null ? avgNow - baseline : null;

  return (
    <div className="space-y-6">
      {/* ─── Sarlavha ─── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl shrink-0"><TrendingUp size={16} /></div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {userName ? `${userName} — Oʻsish grafigi` : "Oʻsish grafigi"}
          </h3>
          <p className="text-xs text-gray-400">Ilk qabul bazasidan bugungi kungacha</p>
        </div>
        {improvement != null && (
          <div className={`ml-auto px-3 py-1.5 rounded-xl text-sm font-bold ${
            improvement >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {improvement >= 0 ? <TrendingUp size={12} className="inline" /> : <TrendingDown size={12} className="inline" />} {Math.abs(improvement).toFixed(1)}%
          </div>
        )}
      </div>

      {/* ─── Grafik ─── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {data.subjects.map((subj, i) => (
                <linearGradient key={subj} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              labelStyle={{ fontSize: '11px', color: '#6b7280' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

            {/* Ilk qabul baseline chizig'i */}
            {baseline != null && (
              <ReferenceLine
                y={baseline}
                stroke="#f59e0b"
                strokeDasharray="6 3"
                label={{ value: `Ilk qabul: ${baseline.toFixed(0)}%`, fontSize: 10, fill: '#f59e0b' }}
              />
            )}

            {data.subjects.map((subj, i) => (
              <Area
                key={subj}
                type="monotone"
                dataKey={subj}
                stroke={SUBJECT_COLORS[i % SUBJECT_COLORS.length]}
                strokeWidth={2}
                fill={`url(#grad-${i})`}
                dot={{ r: 3, fill: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Fan bo'yicha hozirgi holat ─── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Fan bo'yicha holat</h3>
        <div className="space-y-2">
          {Array.from(latestBySubject.entries()).map(([name, snap], i) => {
            const color  = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
            const pct    = snap.score;
            return (
              <div key={name} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-900">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{snap.testCount} test</span>
                    <span className={`text-sm font-bold`} style={{ color }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-gray-400">Davomat: {snap.attendanceRate.toFixed(0)}%</span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(snap.date).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

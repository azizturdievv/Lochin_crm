'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, ResponsiveContainer, Legend,
} from 'recharts';
import api from '@/lib/api';
import KpiCard from '@/components/ui/KpiCard';
import { useAuthStore } from '@/store/auth.store';
import type {
  DashboardStats,
  RecentPayment,
  AttendanceChartPoint,
} from '@/types';

// ─── PULNI FORMATLASH ────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ─── SO'ROV FUNKSIYALARI ─────────────────────────────────────────────────────
const fetchStats     = () => api.get<DashboardStats>('/reports/dashboard').then(r => r.data);
const fetchPayments  = () => api.get<RecentPayment[]>('/payments?limit=5').then(r => r.data);
const fetchAttendance = () => api.get<AttendanceChartPoint[]>('/attendance/today').then(r => r.data);

// ─── TO'LOV USULI RANGI ───────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  cash: 'Naqd', card: 'Karta', payme: 'Payme',
  click: 'Click', bank: 'Bank', mixed: 'Aralash',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'student';

  const { data: stats,      isLoading: statsLoading }     = useQuery({ queryKey: ['dashboard-stats'],     queryFn: fetchStats });
  const { data: payments,   isLoading: paymentsLoading }  = useQuery({ queryKey: ['recent-payments'],     queryFn: fetchPayments,   enabled: role !== 'student' });
  const { data: attendance, isLoading: attendanceLoading} = useQuery({ queryKey: ['today-attendance'],    queryFn: fetchAttendance, enabled: role !== 'student' });

  const today = new Date().toLocaleDateString('uz-UZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-6">

      {/* Salom */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Xush kelibsiz, {user?.firstName}! 👋
        </h2>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">{today}</p>
      </div>

      {/* ── KPI KARTALAR ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Oylik daromad"
          value={statsLoading ? '...' : `${fmt(stats?.revenue.month ?? 0)} so'm`}
          sub={`Bugun: ${fmt(stats?.revenue.today ?? 0)} so'm`}
          icon="💰"
          color="emerald"
          trend={stats ? { value: 12, label: 'O\'tgan oyga nisbatan' } : undefined}
          loading={statsLoading}
        />
        <KpiCard
          title="Faol o'quvchilar"
          value={statsLoading ? '...' : stats?.students.active ?? 0}
          sub={`Jami: ${stats?.students.total ?? 0} | Yangi: ${stats?.students.newThisMonth ?? 0}`}
          icon="👥"
          color="blue"
          trend={stats ? { value: 5, label: 'Bu oy qo\'shilgan' } : undefined}
          loading={statsLoading}
        />
        <KpiCard
          title="Qarzdorlar"
          value={statsLoading ? '...' : stats?.debt.count ?? 0}
          sub={`Jami qarz: ${fmt(stats?.debt.total ?? 0)} so'm`}
          icon="⚠️"
          color="red"
          loading={statsLoading}
        />
        <KpiCard
          title="Bugungi davomat"
          value={statsLoading ? '...' : `${stats?.attendance.rateToday ?? 0}%`}
          sub={`${stats?.attendance.presentToday ?? 0} / ${stats?.attendance.totalToday ?? 0} o'quvchi`}
          icon="✅"
          color="purple"
          loading={statsLoading}
        />
      </div>

      {/* ── GRAFIKLAR ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bugungi davomat barchart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            📊 Bugungi davomat (soatlar bo'yicha)
          </h3>
          {attendanceLoading ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendance ?? MOCK_ATTENDANCE} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => [value, name === 'present' ? 'Keldi' : name === 'absent' ? 'Kelmadi' : 'Kech']}
                />
                <Legend
                  formatter={(v) => v === 'present' ? 'Keldi' : v === 'absent' ? 'Kelmadi' : 'Kech'}
                />
                <Bar dataKey="present" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="late"    fill="#f59e0b" radius={[4,4,0,0]} />
                <Bar dataKey="absent"  fill="#f87171" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daromad trend line chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            📈 So'nggi 7 kunlik daromad
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={MOCK_REVENUE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => [`${fmt(Number(v))} so'm`, "Daromad"]} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#10b981' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── OXIRGI TO'LOVLAR ─────────────────────────────────────────── */}
      {role !== 'student' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">💳 Oxirgi to'lovlar</h3>
            <a href="/dashboard/payments" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Barchasi →
            </a>
          </div>

          {paymentsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">O'quvchi</th>
                    <th className="text-right px-6 py-3 font-medium">Miqdor</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Usul</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Sana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(payments ?? MOCK_PAYMENTS).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-gray-900">{p.studentName}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">
                        {fmt(p.amount)} so'm
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                          {METHOD_LABELS[p.method] ?? p.method}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs hidden md:table-cell">
                        {new Date(p.createdAt).toLocaleDateString('uz-UZ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MOCK MA'LUMOTLAR (API ulangunicha) ────────────────────────────────────────
const MOCK_ATTENDANCE: AttendanceChartPoint[] = [
  { hour: '08:00', present: 28, absent: 4,  late: 2 },
  { hour: '10:00', present: 32, absent: 2,  late: 3 },
  { hour: '14:00', present: 25, absent: 6,  late: 1 },
  { hour: '16:00', present: 30, absent: 3,  late: 2 },
];

const MOCK_REVENUE = [
  { date: 'Du', amount: 2_400_000 },
  { date: 'Se', amount: 3_100_000 },
  { date: 'Ch', amount: 1_800_000 },
  { date: 'Pa', amount: 4_200_000 },
  { date: 'Ju', amount: 3_600_000 },
  { date: 'Sh', amount: 1_200_000 },
  { date: 'Ya', amount: 900_000  },
];

const MOCK_PAYMENTS: RecentPayment[] = [
  { id: '1', studentName: 'Alisher Karimov',  amount: 450_000,  method: 'cash',  createdAt: new Date().toISOString() },
  { id: '2', studentName: 'Dilnoza Yusupova', amount: 320_000,  method: 'payme', createdAt: new Date().toISOString() },
  { id: '3', studentName: 'Bobur Toshmatov',  amount: 600_000,  method: 'card',  createdAt: new Date().toISOString() },
  { id: '4', studentName: 'Kamola Mirzaeva',  amount: 280_000,  method: 'click', createdAt: new Date().toISOString() },
  { id: '5', studentName: 'Jasur Xoliqov',    amount: 500_000,  method: 'cash',  createdAt: new Date().toISOString() },
];

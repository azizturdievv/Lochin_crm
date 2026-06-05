'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import api from '@/lib/api';
import KpiCard from '@/components/ui/KpiCard';
import { useAuthStore } from '@/store/auth.store';
import type { AdminDashboard, TeacherDashboard, StudentDashboard, DashboardData } from '@/types';

// ─── YORDAMCHI FUNKSIYALAR ────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
}
function fmtTime(t: string): string {
  return t?.slice(0, 5) ?? '—';
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Naqd', card: 'Karta', payme: 'Payme',
  click: 'Click', bank: 'Bank', mixed: 'Aralash',
};

// ─── LOADER PLACEHOLDER ───────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-gray-100 animate-pulse rounded-xl ${className ?? 'h-10'}`} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
//   ADMIN / MANAGER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function AdminDashboardView({ data, loading }: { data?: AdminDashboard; loading: boolean }) {
  return (
    <div className="space-y-6">

      {/* KPI kartalar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Oylik daromad"
          value={loading ? '...' : `${fmt(data?.revenue.month ?? 0)} so'm`}
          sub={`Bugun: ${fmt(data?.revenue.today ?? 0)} so'm`}
          icon="💰" color="emerald" loading={loading}
          trend={data ? { value: 12, label: "O'tgan oyga nisbatan" } : undefined}
        />
        <KpiCard
          title="Faol o'quvchilar"
          value={loading ? '...' : (data?.students.active ?? 0)}
          sub={`Jami: ${data?.students.total ?? 0} | Yangi: ${data?.students.newThisMonth ?? 0}`}
          icon="👥" color="blue" loading={loading}
        />
        <KpiCard
          title="Qarzdorlar"
          value={loading ? '...' : (data?.debt.count ?? 0)}
          sub="To'lov qilmagan o'quvchilar"
          icon="⚠️" color="red" loading={loading}
        />
        <KpiCard
          title="Bugungi davomat"
          value={loading ? '...' : `${data?.attendance.rateToday ?? 0}%`}
          sub={`${data?.attendance.presentToday ?? 0} / ${data?.attendance.totalToday ?? 0} o'quvchi`}
          icon="✅" color="purple" loading={loading}
        />
      </div>

      {/* Grafiklar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 7 kunlik daromad */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">📈 So'nggi 7 kunlik daromad</h3>
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.revenueChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={v => `${(Number(v)/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={v => [`${fmt(Number(v))} so'm`, 'Daromad']} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Xodimlar KPI */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">👨‍🏫 Xodimlar KPI (guruh / o'quvchi)</h3>
          {loading ? <Skeleton className="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.staffKpi ?? []} layout="vertical" barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v, n) => [v, n === 'students' ? "O'quvchi" : 'Guruh']} />
                <Bar dataKey="students" fill="#3b82f6" radius={[0, 4, 4, 0]} name="students" />
                <Bar dataKey="groups"   fill="#10b981" radius={[0, 4, 4, 0]} name="groups" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Oxirgi to'lovlar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">💳 Oxirgi to'lovlar</h3>
          <a href="/dashboard/payments"
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Barchasi →
          </a>
        </div>
        {loading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} />)}</div>
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
                {(data?.recentPayments ?? []).map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">{p.studentName}</td>
                    <td className="px-6 py-3.5 text-right font-semibold text-emerald-600">
                      {fmt(p.amount)} so'm
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {PAYMENT_LABELS[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-400 text-xs hidden md:table-cell">
                      {fmtDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
                {!data?.recentPayments?.length && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 text-sm">
                    Hali to'lov mavjud emas
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//   USTOZ DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function TeacherDashboardView({ data, loading }: { data?: TeacherDashboard; loading: boolean }) {
  const totalStudents = data?.groups.reduce((s, g) => s + g.currentStudents, 0) ?? 0;

  return (
    <div className="space-y-6">

      {/* KPI kartalar */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Guruhlarim"
          value={loading ? '...' : (data?.groups.length ?? 0)}
          sub={`Jami ${totalStudents} o'quvchi`}
          icon="🏫" color="blue" loading={loading}
        />
        <KpiCard
          title="Bugungi darslar"
          value={loading ? '...' : (data?.todayLessons.length ?? 0)}
          sub="Rejalashtirilgan"
          icon="📅" color="emerald" loading={loading}
        />
        <KpiCard
          title="O'rtacha test bali"
          value={loading ? '...' : `${data?.testStats.avgScore ?? 0}%`}
          sub={`${data?.testStats.totalTests ?? 0} test, ${data?.testStats.published ?? 0} nashr`}
          icon="📝" color="purple" loading={loading}
        />
      </div>

      {/* Bugungi darslar */}
      {(loading || (data?.todayLessons.length ?? 0) > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">📅 Bugungi darslar</h3>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} />)}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data?.todayLessons.map(l => (
                <div key={l.id} className="px-6 py-4 flex items-center gap-4">
                  {/* Vaqt */}
                  <div className="text-center w-16 shrink-0">
                    <div className="text-sm font-semibold text-gray-900">{fmtTime(l.startTime)}</div>
                    <div className="text-xs text-gray-400">{fmtTime(l.endTime)}</div>
                  </div>
                  {/* Guruh */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{l.groupName}</p>
                    <p className="text-xs text-gray-500">{l.subjectName}{l.room ? ` · ${l.room}-xona` : ''}</p>
                  </div>
                  {/* Davomat */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-emerald-600">{l.present}</span>
                    <span className="text-gray-400 text-sm"> / {l.total}</span>
                    {l.late > 0 && (
                      <span className="ml-2 text-xs text-amber-500">+{l.late} kech</span>
                    )}
                  </div>
                  {/* Status */}
                  <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                    l.status === 'completed' ? 'bg-green-50 text-green-700' :
                    l.status === 'ongoing'   ? 'bg-blue-50 text-blue-700'  :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {l.status === 'completed' ? 'Tugadi' : l.status === 'ongoing' ? 'Davom etmoqda' : 'Rejalashtirilgan'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guruhlar grid */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">🏫 Guruhlarim</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.groups.map(g => (
              <div key={g.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{g.name}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{g.subjectName}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-lg">
                    {g.currentStudents}/{g.maxStudents}
                  </span>
                </div>
                {/* Sig'im progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (g.currentStudents / g.maxStudents) * 100)}%` }}
                  />
                </div>
                {g.nextLesson ? (
                  <p className="text-xs text-gray-400">
                    Keyingi: {fmtDate(g.nextLesson.date)} · {fmtTime(g.nextLesson.startTime)}–{fmtTime(g.nextLesson.endTime)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-300">Keyingi dars yo'q</p>
                )}
              </div>
            ))}
            {!data?.groups.length && (
              <div className="col-span-3 py-12 text-center text-gray-400 text-sm">
                Hali guruh tayinlanmagan
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//   STUDENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function StudentDashboardView({ data, loading, firstName }: {
  data?: StudentDashboard; loading: boolean; firstName?: string;
}) {
  const hasDebt = data?.paymentStatus.hasDebt ?? false;

  return (
    <div className="space-y-5">

      {/* KPI kartalar */}
      <div className="grid grid-cols-2 gap-4">
        {/* Ball */}
        <KpiCard
          title="Umumiy balim"
          value={loading ? '...' : (data?.totalPoints ?? 0)}
          sub="Jami to'plagan ballar"
          icon="⭐" color="emerald" loading={loading}
        />
        {/* Davomat */}
        <KpiCard
          title="Davomatim"
          value={loading ? '...' : `${data?.attendanceRate ?? 0}%`}
          sub={loading ? '' : `${data?.attendedDays ?? 0} / ${data?.totalDays ?? 0} (30 kun)`}
          icon="✅" color="blue" loading={loading}
        />
      </div>

      {/* Keyingi dars + To'lov holati */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Keyingi dars */}
        <div className={`rounded-2xl p-5 border ${
          loading ? 'bg-white border-gray-100' :
          data?.nextLesson ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📚</span>
            <span className="text-sm font-semibold text-gray-700">Keyingi dars</span>
          </div>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
          ) : data?.nextLesson ? (
            <>
              <p className="font-semibold text-gray-900 text-lg">{data.nextLesson.subjectName}</p>
              <p className="text-sm text-indigo-600 mt-1">{data.nextLesson.groupName}</p>
              <p className="text-xs text-gray-500 mt-2">
                {fmtDate(data.nextLesson.date)} · {fmtTime(data.nextLesson.startTime)}–{fmtTime(data.nextLesson.endTime)}
                {data.nextLesson.room ? ` · ${data.nextLesson.room}-xona` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Hozircha dars rejalashtirilmagan</p>
          )}
        </div>

        {/* To'lov holati */}
        <div className={`rounded-2xl p-5 border ${
          loading ? 'bg-white border-gray-100' :
          hasDebt ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{hasDebt ? '⚠️' : '✅'}</span>
            <span className="text-sm font-semibold text-gray-700">To'lov holati</span>
          </div>
          {loading ? (
            <div className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
          ) : (
            <>
              <p className={`font-semibold text-lg ${hasDebt ? 'text-red-700' : 'text-green-700'}`}>
                {hasDebt ? "To'lov kutilmoqda" : "To'langan ✓"}
              </p>
              {data?.paymentStatus.paidThisMonth !== undefined && (
                <p className="text-xs text-gray-500 mt-2">
                  {hasDebt
                    ? "Joriy oy to'lov qilinmagan"
                    : `Bu oy: ${fmt(data.paymentStatus.paidThisMonth)} so'm`}
                </p>
              )}
              {hasDebt && (
                <a href="/dashboard/payments"
                  className="inline-block mt-2 text-xs text-red-600 hover:text-red-700 font-medium">
                  To'lov qilish →
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Oxirgi test natijasi */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📝</span>
          <h3 className="text-sm font-semibold text-gray-700">Oxirgi test natijasi</h3>
        </div>
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-5" /><Skeleton className="h-4 w-2/3" /></div>
        ) : data?.lastTestResult ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{data.lastTestResult.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(data.lastTestResult.finishedAt)}</p>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${
                data.lastTestResult.score >= 80 ? 'text-green-600' :
                data.lastTestResult.score >= 60 ? 'text-yellow-600' : 'text-red-500'
              }`}>
                {Math.round(data.lastTestResult.score)}%
              </div>
              <div className="text-xs text-amber-500 mt-0.5">+{data.lastTestResult.earnedPoints} ball</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Hali test topshirilmagan</p>
        )}
        {data?.lastTestResult && (
          <a href="/dashboard/lms"
            className="mt-3 block text-center text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Barcha testlar →
          </a>
        )}
      </div>

      {/* Motivatsiya banner */}
      {!loading && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 text-white">
          <p className="font-semibold text-lg">
            Salom, {firstName}! 🌟
          </p>
          <p className="text-emerald-100 text-sm mt-1">
            {(data?.totalPoints ?? 0) >= 100
              ? `${data?.totalPoints ?? 0} ball to'pladingiz! Zo'r natija! 🎉`
              : `Maqsad: 100 ball. Hozircha: ${data?.totalPoints ?? 0} ball. Davom eting!`}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//   ASOSIY SAHIFA
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'student';

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', role],
    queryFn: () => api.get<DashboardData>('/reports/dashboard').then(r => r.data),
    staleTime: 60_000,
  });

  const today = new Date().toLocaleDateString('uz-UZ', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const roleLabel: Record<string, string> = {
    super_admin: '⚙️ Super Admin',
    manager:     '🗂️ Menejer',
    ustoz:       '👨‍🏫 Ustoz',
    student:     '🎓 O\'quvchi',
  };

  return (
    <div className="space-y-6">

      {/* Salom banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Xush kelibsiz, {user?.firstName}!
          </h2>
          <p className="text-gray-400 text-sm mt-0.5 capitalize">{today}</p>
        </div>
        <span className="hidden sm:inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
          {roleLabel[role] ?? role}
        </span>
      </div>

      {/* Rol bo'yicha ko'rinish */}
      {(role === 'super_admin' || role === 'manager') && (
        <AdminDashboardView
          data={data as AdminDashboard}
          loading={isLoading}
        />
      )}

      {role === 'ustoz' && (
        <TeacherDashboardView
          data={data as TeacherDashboard}
          loading={isLoading}
        />
      )}

      {role === 'student' && (
        <StudentDashboardView
          data={data as StudentDashboard}
          loading={isLoading}
          firstName={user?.firstName}
        />
      )}
    </div>
  );
}

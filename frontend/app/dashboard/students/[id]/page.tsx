'use client';

import { useState } from 'react';
import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import api from '@/lib/api';
import StudentModal from '@/components/students/StudentModal';
import type { StudentDetail, EnrollmentRecord } from '@/types/students';

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchStudent = (id: string) =>
  api.get<StudentDetail>(`/students/${id}`).then(r => r.data);

const fetchProgress = (id: string) =>
  api.get(`/students/${id}/progress`).then(r => r.data);

// ─── ENROLMENT HOLATI ─────────────────────────────────────────────────────────
const ENROLL_STATUS: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Faol',        cls: 'bg-emerald-100 text-emerald-700' },
  paused:    { label: 'To\'xtatilgan', cls: 'bg-amber-100 text-amber-700'   },
  completed: { label: 'Yakunlangan', cls: 'bg-blue-100 text-blue-700'      },
  dropped:   { label: 'Chiqib ketdi', cls: 'bg-red-100 text-red-600'       },
};

// ─── SAHIFA ───────────────────────────────────────────────────────────────────
export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc     = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: student, isLoading, isError } = useQuery({
    queryKey: ['student', id],
    queryFn:  () => fetchStudent(id),
  });

  const { data: progress } = useQuery({
    queryKey: ['student-progress', id],
    queryFn:  () => fetchProgress(id),
    enabled:  !!student,
  });

  // Guruhdan chiqarish
  const unenrollMut = useMutation({
    mutationFn: (enrollmentId: string) =>
      api.delete(`/students/${id}/enrollments/${enrollmentId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', id] }),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !student) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <div className="text-5xl mb-3">😕</div>
        <p className="font-medium">O'quvchi topilmadi</p>
        <Link href="/dashboard/students" className="mt-4 text-sm text-emerald-600 hover:underline">
          ← Ro'yxatga qaytish
        </Link>
      </div>
    );
  }

  const initials   = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  const fullName   = `${student.lastName} ${student.firstName}${student.middleName ? ' ' + student.middleName : ''}`;
  const primaryParent = student.parents?.find(p => p.isPrimary) ?? student.parents?.[0];

  // Radar chart uchun ma'lumot
  const radarData = progress ? [
    { subject: 'Davomat',  value: progress.attendance?.rate ?? 0 },
    { subject: 'Test',     value: progress.tests?.avg ?? 0 },
    { subject: 'Vazifa',   value: progress.homework?.completion ?? 0 },
    { subject: 'Imlo',     value: Math.max(0, 100 - (progress.spelling?.errorCount ?? 0) * 5) },
    { subject: 'Balllar',  value: Math.min(100, (student.totalPoints / 500) * 100) },
  ] : [];

  return (
    <div className="space-y-6">

      {/* ── BREADCRUMB ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard/students" className="hover:text-emerald-600 transition-colors">
          O'quvchilar
        </Link>
        <span>›</span>
        <span className="text-gray-700 font-medium">{fullName}</span>
      </div>

      {/* ── HEADER KARTA ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="text-emerald-700 text-xl font-bold">{initials}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{fullName}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  student.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {student.isActive ? 'Faol' : 'Arxivlangan'}
                </span>
                <span className="text-gray-400 text-xs">
                  {new Date(student.createdAt).toLocaleDateString('uz-UZ', { year:'numeric', month:'long', day:'numeric' })} dan
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            ✏️ Tahrirlash
          </button>
        </div>

        {/* Kontaktlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-gray-100">
          <InfoItem icon="📧" label="Email"  value={student.email} />
          <InfoItem icon="📱" label="Telefon" value={student.phone ?? '—'} />
          <InfoItem icon="🎂" label="Tug'ilgan"
            value={student.birthDate ? new Date(student.birthDate).toLocaleDateString('uz-UZ') : '—'} />
          <InfoItem icon="⭐" label="Ball" value={String(student.totalPoints)} />
        </div>
      </div>

      {/* ── PROGRESS + OTA-ONA ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Radar progress grafigi */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">📊 O'quvchi profili</h3>
          {progress && radarData.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 items-center">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                  <Radar
                    dataKey="value"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Tooltip formatter={(v) => [`${v}%`]} />
                </RadarChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                <StatRow icon="✅" label="Davomat"  value={`${progress.attendance?.rate ?? 0}%`}      color="emerald" />
                <StatRow icon="📝" label="Test o'rt." value={`${progress.tests?.avg ?? 0}%`}           color="blue"    />
                <StatRow icon="📚" label="Vazifa"   value={`${progress.homework?.completion ?? 0}%`}  color="purple"  />
                <StatRow icon="✍️" label="Imlo xato" value={`${progress.spelling?.errorCount ?? 0} ta`} color="amber"  />
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Progress ma'lumotlari yuklanmoqda...
            </div>
          )}
        </div>

        {/* Ota-ona */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">👪 Ota-ona</h3>
          {student.parents?.length ? (
            <div className="space-y-4">
              {student.parents.map((p) => (
                <div key={p.id} className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                    {p.isPrimary && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Asosiy</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">📱 {p.phone}</p>
                  {p.phone2 && <p className="text-xs text-gray-500">📱 {p.phone2}</p>}
                  {p.relation && (
                    <p className="text-xs text-gray-400 capitalize">{p.relation}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Ota-ona qo'shilmagan</p>
          )}
        </div>
      </div>

      {/* ── GURUHLAR ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">
            🏫 Guruhlar
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({student.enrollments?.length ?? 0} ta)
            </span>
          </h3>
        </div>

        {!student.enrollments?.length ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-4xl mb-2">🏫</p>
            <p className="text-sm">Hali guruhga yozilmagan</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {student.enrollments.map((enr: EnrollmentRecord) => {
              const st = ENROLL_STATUS[enr.status] ?? ENROLL_STATUS.active;
              return (
                <div key={enr.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 text-sm">📚</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{enr.group.name}</p>
                      <p className="text-gray-400 text-xs">{enr.group.subject?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {enr.discountPercent > 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        -{enr.discountPercent}%
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(enr.enrolledAt).toLocaleDateString('uz-UZ')}
                    </span>
                    {enr.status === 'active' && (
                      <button
                        onClick={() => unenrollMut.mutate(enr.id)}
                        disabled={unenrollMut.isPending}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        title="Guruhdan chiqarish"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tahrirlash modali */}
      <StudentModal
        open={editOpen}
        student={student}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

// ─── YORDAMCHI KOMPONENTLAR ───────────────────────────────────────────────────
function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
        <span>{icon}</span> {value}
      </p>
    </div>
  );
}

const STAT_COLORS = {
  emerald: 'bg-emerald-500',
  blue:    'bg-blue-500',
  purple:  'bg-purple-500',
  amber:   'bg-amber-500',
} as const;

function StatRow({ icon, label, value, color }: {
  icon: string; label: string; value: string; color: keyof typeof STAT_COLORS;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${STAT_COLORS[color]}`} />
        <span className="text-sm text-gray-600">{icon} {label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-48" />
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <div className="flex gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gray-200" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-100 rounded w-32" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

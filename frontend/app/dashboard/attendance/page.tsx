'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';
import QrCodeCard from '@/components/attendance/QrCodeCard';
import ManualMarkModal from '@/components/attendance/ManualMarkModal';
import BulkManualModal from '@/components/attendance/BulkManualModal';
import ExcuseModal from '@/components/attendance/ExcuseModal';
import AttendanceStats from '@/components/attendance/AttendanceStats';
import { STATUS_META } from '@/types/attendance';
import type { LessonAttendance, AttendanceRecord, AttendanceStatus } from '@/types/attendance';

// ─── YORDAMCHI FUNKSIYALAR ────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────
interface GroupOption { id: string; name: string; subject: { name: string } | null; }

const fetchLessons = (date: string, groupId?: string) => {
  const params: Record<string, string> = { date };
  if (groupId) params.groupId = groupId;
  return api.get<LessonAttendance[]>('/attendance/today', { params }).then(r => r.data);
};

const fetchLesson = (id: string) =>
  api.get<LessonAttendance>(`/attendance/lesson/${id}`).then(r => r.data);

// ─── CSV EKSPORT ──────────────────────────────────────────────────────────────
function exportCsv(records: AttendanceRecord[], label: string) {
  const BOM  = '﻿';
  const rows = [
    ["O'quvchi", 'Telefon', 'Holat', 'Kech (daqiqa)', 'QR vaqti', 'Sabab'],
    ...records.map(r => [
      `${r.student.lastName} ${r.student.firstName}`,
      r.student.phone ?? '',
      STATUS_META[r.status].label,
      r.lateMinutes != null ? String(r.lateMinutes) : '',
      r.scannedAt ? new Date(r.scannedAt).toLocaleTimeString('uz-UZ') : '',
      r.excuseReason ?? '',
    ]),
  ];
  const csv  = rows.map(row => row.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `davomat-${label}-${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── STATUS FILTRLARI ─────────────────────────────────────────────────────────
const STATUS_FILTERS: (AttendanceStatus | 'all')[] = [
  'all', 'present', 'late', 'absent', 'excused', 'unexcused',
];

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const qc   = useQueryClient();
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? 'manager';

  // ─── HOLAT ────────────────────────────────────────────────────────────────
  const [selectedDate,     setSelectedDate]     = useState(todayStr());
  const [selectedGroupId,  setSelectedGroupId]  = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [qrVisible,        setQrVisible]        = useState(false);
  const [statusFilter,     setStatusFilter]     = useState<AttendanceStatus | 'all'>('all');
  const [searchQ,          setSearchQ]          = useState('');
  const [markTarget,       setMarkTarget]       = useState<AttendanceRecord | null>(null);
  const [excuseTarget,     setExcuseTarget]     = useState<AttendanceRecord | null>(null);
  const [bulkOpen,         setBulkOpen]         = useState(false);
  const [toast,            setToast]            = useState<string | null>(null);

  // ─── SOCKET ───────────────────────────────────────────────────────────────
  const { lastEvent, connected } = useAttendanceSocket(selectedLessonId);

  useEffect(() => {
    if (!lastEvent || !selectedLessonId) return;
    qc.invalidateQueries({ queryKey: ['lesson-attendance', selectedLessonId] });
    qc.invalidateQueries({ queryKey: ['lessons-list', selectedDate, selectedGroupId] });
  }, [lastEvent, selectedLessonId, qc, selectedDate, selectedGroupId]);

  useEffect(() => {
    if (!lastEvent) return;
    const name = `${lastEvent.record.student?.lastName} ${lastEvent.record.student?.firstName}`;
    showToast(`${STATUS_META[lastEvent.record.status as AttendanceStatus]?.icon} ${name}`);
  }, [lastEvent]);

  // ─── QUERY: GURUHLAR ──────────────────────────────────────────────────────
  const { data: groups } = useQuery({
    queryKey: ['groups-attendance-filter'],
    queryFn:  () => api.get<{ data: GroupOption[] }>('/groups', {
      params: { isActive: 'true', limit: 100 },
    }).then(r => r.data.data),
  });

  // ─── QUERY: DARSLAR RO'YXATI ──────────────────────────────────────────────
  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons-list', selectedDate, selectedGroupId],
    queryFn:  () => fetchLessons(selectedDate, selectedGroupId || undefined),
    refetchInterval: 30_000,
  });

  // ─── QUERY: TANLANGAN DARS ───────────────────────────────────────────────
  const { data: lessonData, isLoading: lessonLoading } = useQuery({
    queryKey: ['lesson-attendance', selectedLessonId],
    queryFn:  () => fetchLesson(selectedLessonId!),
    enabled:  !!selectedLessonId,
    refetchInterval: 15_000,
  });

  // ─── BIRINCHI DARSNI AVTO-TANLASH ────────────────────────────────────────
  useEffect(() => {
    if (lessons?.length && !selectedLessonId) {
      setSelectedLessonId(lessons[0].lesson.id);
    }
  }, [lessons, selectedLessonId]);

  // Sana/guruh o'zgarganda dars tanlovini tiklash
  useEffect(() => {
    setSelectedLessonId(null);
    setStatusFilter('all');
    setSearchQ('');
  }, [selectedDate, selectedGroupId]);

  // ─── FILTRLANGAN YOZUVLAR ────────────────────────────────────────────────
  const records = useCallback(() => {
    if (!lessonData) return [];
    return lessonData.attendance.filter(r => {
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchSearch = !searchQ || (
        `${r.student.lastName} ${r.student.firstName}`.toLowerCase().includes(searchQ.toLowerCase()) ||
        (r.student.phone?.includes(searchQ) ?? false)
      );
      return matchStatus && matchSearch;
    });
  }, [lessonData, statusFilter, searchQ]);

  const filteredRecords = records();
  const canMark   = role === 'super_admin' || role === 'manager' || role === 'ustoz';
  const canExcuse = role === 'super_admin' || role === 'manager' || role === 'ustoz';

  const selectedLesson = lessons?.find(l => l.lesson.id === selectedLessonId);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-4">

      {/* ── YUQORI ASBOBLAR PANELI ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3 flex flex-wrap items-center gap-3">

        {/* Sana tanlash */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">📅</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {selectedDate !== todayStr() && (
            <button
              onClick={() => setSelectedDate(todayStr())}
              className="text-xs text-emerald-600 hover:text-emerald-700 underline"
            >
              Bugun
            </button>
          )}
        </div>

        {/* Guruh tanlash */}
        <select
          value={selectedGroupId}
          onChange={e => setSelectedGroupId(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Barcha guruhlar</option>
          {groups?.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}{g.subject ? ` — ${g.subject.name}` : ''}
            </option>
          ))}
        </select>

        {/* Sana ko'rsatish */}
        <span className="text-xs text-gray-400">
          {formatDate(selectedDate)} — {lessons?.length ?? 0} ta dars
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* QR ko'rish tugmasi */}
          <button
            onClick={() => setQrVisible(v => !v)}
            disabled={!selectedLessonId}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-xl border transition font-medium disabled:opacity-40 ${
              qrVisible
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            📱 {qrVisible ? "QR yashirish" : "QR ko'rish"}
          </button>

          {/* Qo'lda kiritish */}
          {canMark && (
            <button
              onClick={() => setBulkOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-medium"
            >
              ✏️ Qo'lda kiritish
            </button>
          )}
        </div>
      </div>

      {/* ── ASOSIY KONTENT ─────────────────────────────────────────────── */}
      <div className="flex gap-5 min-h-[calc(100vh-13rem)]">

        {/* ── CHAP: DARSLAR RO'YXATI ─────────────────────────────────── */}
        <aside className="w-60 shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Darslar
            </h3>
            <span className="text-xs text-gray-400">{lessons?.length ?? 0} ta</span>
          </div>

          {lessonsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))
          ) : !lessons?.length ? (
            <div className="text-center py-10 text-gray-400">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-xs">
                {selectedDate === todayStr()
                  ? 'Bugun dars yo\'q'
                  : `${formatDate(selectedDate)} da dars yo'q`}
              </p>
            </div>
          ) : (
            lessons.map(l => (
              <LessonCard
                key={l.lesson.id}
                lessonData={l}
                selected={l.lesson.id === selectedLessonId}
                onClick={() => setSelectedLessonId(l.lesson.id)}
              />
            ))
          )}
        </aside>

        {/* ── O'NG: TANLANGAN DARS DAVOMATI ──────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {!selectedLessonId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <div className="text-4xl mb-2">👈</div>
              <p className="text-sm">Dars tanlang</p>
            </div>
          ) : (
            <>
              {/* ── SARLAVHA ──────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    {selectedLesson?.lesson.group.name} — {selectedLesson?.lesson.group.subject.name}
                  </h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    {selectedLesson?.lesson.startTime}–{selectedLesson?.lesson.endTime}
                    {selectedLesson?.lesson.teacher.lastName && (
                      <> • {selectedLesson.lesson.teacher.lastName} {selectedLesson.lesson.teacher.firstName}</>
                    )}
                    {' '}
                    <span className={`inline-flex items-center gap-1 ${connected ? 'text-emerald-500' : 'text-gray-300'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {connected ? 'Real-time' : 'Offline'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => lessonData && exportCsv(lessonData.attendance, selectedLesson?.lesson.group.name ?? 'dars')}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                >
                  📥 CSV
                </button>
              </div>

              {/* ── QR + STATISTIKA ───────────────────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* QR karta — faqat qrVisible bo'lganda */}
                {qrVisible && (
                  <QrCodeCard lessonId={selectedLessonId} connected={connected} />
                )}

                {lessonData ? (
                  <div className={qrVisible ? 'lg:col-span-2' : 'lg:col-span-3'}>
                    <AttendanceStats lessonData={lessonData} />
                  </div>
                ) : (
                  <div className={`${qrVisible ? 'lg:col-span-2' : 'lg:col-span-3'} grid grid-cols-3 gap-3 content-start`}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                )}
              </div>

              {/* ── FILTRLAR ──────────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap gap-2 items-center">
                {STATUS_FILTERS.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      statusFilter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {s === 'all'
                      ? 'Barchasi'
                      : `${STATUS_META[s as AttendanceStatus].icon} ${STATUS_META[s as AttendanceStatus].label}`}
                  </button>
                ))}

                <div className="relative ml-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                  <input
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Ism yoki telefon..."
                    className="pl-8 pr-4 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
                  />
                </div>
                <span className="text-xs text-gray-400">{filteredRecords.length} ta</span>
              </div>

              {/* ── DAVOMAT JADVALI ─────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">O'quvchi</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Kech</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Vaqt</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Sabab</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lessonLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 7 }).map((__, j) => (
                              <td key={j} className="px-4 py-3">
                                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : filteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                            <div className="text-4xl mb-2">🔍</div>
                            <p className="text-sm">O'quvchilar topilmadi</p>
                          </td>
                        </tr>
                      ) : (
                        filteredRecords.map((r, idx) => (
                          <AttendanceRow
                            key={`${r.studentId}-${r.id}`}
                            index={idx + 1}
                            record={r}
                            canMark={canMark}
                            canExcuse={canExcuse}
                            isNew={lastEvent?.record.studentId === r.studentId}
                            onMark={() => setMarkTarget(r)}
                            onExcuse={() => setExcuseTarget(r)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── REAL-TIME TOAST ──────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium">
          {toast} — davomat belgilandi
        </div>
      )}

      {/* ── MODALAR ──────────────────────────────────────────────────────── */}
      <ManualMarkModal
        record={markTarget}
        lessonId={selectedLessonId ?? ''}
        onClose={() => setMarkTarget(null)}
      />
      <ExcuseModal
        record={excuseTarget}
        lessonId={selectedLessonId ?? ''}
        onClose={() => setExcuseTarget(null)}
      />
      <BulkManualModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        todayLessons={lessons ?? []}
      />
    </div>
  );
}

// ─── DARS KARTASI ─────────────────────────────────────────────────────────────
function LessonCard({ lessonData, selected, onClick }: {
  lessonData: LessonAttendance; selected: boolean; onClick: () => void;
}) {
  const { lesson, stats } = lessonData;
  const rateColor = stats.rate >= 80 ? 'text-emerald-600' : stats.rate >= 60 ? 'text-amber-600' : 'text-red-600';
  const rateBg    = stats.rate >= 80 ? 'bg-emerald-500' : stats.rate >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
        selected
          ? 'border-emerald-500 bg-emerald-50 shadow-sm'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{lesson.group.name}</p>
          <p className="text-xs text-gray-400 truncate">{lesson.group.subject.name}</p>
        </div>
        <span className={`text-sm font-bold shrink-0 ${rateColor}`}>{stats.rate}%</span>
      </div>
      <p className="text-xs text-gray-400 mb-2">{lesson.startTime}–{lesson.endTime}</p>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${rateBg} rounded-full`} style={{ width: `${stats.rate}%` }} />
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span>✅ {stats.present}</span>
        <span>⏰ {stats.late}</span>
        <span>❌ {stats.absent + stats.unexcused}</span>
        {stats.excused > 0 && <span>📋 {stats.excused}</span>}
      </div>
    </button>
  );
}

// ─── DAVOMAT SATRI ────────────────────────────────────────────────────────────
function AttendanceRow({ index, record, canMark, canExcuse, isNew, onMark, onExcuse }: {
  index:     number;
  record:    AttendanceRecord;
  canMark:   boolean;
  canExcuse: boolean;
  isNew:     boolean;
  onMark:    () => void;
  onExcuse:  () => void;
}) {
  const meta = STATUS_META[record.status as AttendanceStatus];
  const name = `${record.student.lastName} ${record.student.firstName}`;

  return (
    <tr className={`transition-colors group ${isNew ? 'bg-emerald-50/60' : 'hover:bg-gray-50/60'}`}>
      <td className="px-4 py-3 text-gray-400 text-xs">{index}</td>

      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 text-sm">{name}</p>
        {record.student.phone && (
          <p className="text-xs text-gray-400">{record.student.phone}</p>
        )}
      </td>

      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${meta.cls}`}>
          {meta.icon} {meta.label}
        </span>
      </td>

      <td className="px-4 py-3 hidden sm:table-cell">
        {record.lateMinutes != null && record.lateMinutes > 0 ? (
          <span className="text-amber-600 text-sm font-medium">+{record.lateMinutes} daqiqa</span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-400">
        {record.scannedAt
          ? new Date(record.scannedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
          : '—'}
      </td>

      <td className="px-4 py-3 hidden lg:table-cell max-w-xs">
        {record.excuseReason ? (
          <p className="text-xs text-gray-500 truncate" title={record.excuseReason}>
            {record.excuseByParent && <span className="text-blue-500 mr-1">👪</span>}
            {record.excuseReason}
          </p>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canMark && (
            <button onClick={onMark}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 text-sm transition-colors"
              title="Belgilash">
              ✏️
            </button>
          )}
          {/* Faqat haqiqiy yozuv bo'lsa sabab kiritish mumkin */}
          {canExcuse && record.id && (record.status === 'absent' || record.status === 'unexcused') && (
            <button onClick={onExcuse}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 text-sm transition-colors"
              title="Sabab kiritish">
              📋
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

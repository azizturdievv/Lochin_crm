'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { STATUS_META } from '@/types/attendance';
import type { LessonAttendance, AttendanceStatus } from '@/types/attendance';

interface Props {
  open:         boolean;
  onClose:      () => void;
  todayLessons: LessonAttendance[];
}

interface GroupOption { id: string; name: string; subject: { name: string } | null; }
interface StudentRow {
  studentId:   string;
  firstName:   string;
  lastName:    string;
  status:      AttendanceStatus;
  lateMinutes: number;
  excuseReason:string;
}

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'unexcused'];

const STATUS_BTN: Record<AttendanceStatus, string> = {
  present:   'bg-emerald-100 text-emerald-700 border-emerald-300',
  late:      'bg-amber-100 text-amber-700 border-amber-300',
  absent:    'bg-red-100 text-red-700 border-red-300',
  excused:   'bg-blue-100 text-blue-700 border-blue-300',
  unexcused: 'bg-gray-100 text-gray-700 border-gray-300',
};

export default function BulkManualModal({ open, onClose, todayLessons }: Props) {
  const qc = useQueryClient();

  const [groupId,  setGroupId]  = useState('');
  const [lessonId, setLessonId] = useState('');
  const [rows,     setRows]     = useState<StudentRow[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(0);

  // Guruhlar ro'yxati
  const { data: groups } = useQuery({
    queryKey: ['groups-bulk-modal'],
    queryFn: () =>
      api.get<{ data: GroupOption[] }>('/groups', { params: { isActive: 'true', limit: 100 } })
        .then(r => r.data.data),
    enabled: open,
  });

  // Tanlangan dars o'quvchilari
  const { data: lessonData, isFetching: lessonLoading } = useQuery({
    queryKey: ['lesson-attendance-bulk', lessonId],
    queryFn:  () => api.get<LessonAttendance>(`/attendance/lesson/${lessonId}`).then(r => r.data),
    enabled:  open && !!lessonId,
  });

  // Dars ma'lumotlari yuklanganda rows ni to'ldirish
  useEffect(() => {
    if (!lessonData) return;
    setRows(
      lessonData.attendance.map(r => ({
        studentId:   r.studentId,
        firstName:   r.student.firstName,
        lastName:    r.student.lastName,
        status:      r.status,
        lateMinutes: r.lateMinutes ?? 0,
        excuseReason: r.excuseReason ?? '',
      })),
    );
  }, [lessonData]);

  // Guruh o'zgarganda darsni tozalash
  useEffect(() => {
    setLessonId('');
    setRows([]);
  }, [groupId]);

  // Modal yopilganda reset
  useEffect(() => {
    if (!open) {
      setGroupId('');
      setLessonId('');
      setRows([]);
      setError('');
      setDone(0);
    }
  }, [open]);

  // Bugungi darslar — tanlangan guruh bo'yicha filtr
  const groupLessons = todayLessons.filter(l => !groupId || l.lesson.groupId === groupId);

  function setStatus(idx: number, status: AttendanceStatus) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, status, lateMinutes: status === 'late' ? (r.lateMinutes || 5) : 0 } : r));
  }

  function setLate(idx: number, val: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, lateMinutes: val } : r));
  }

  // Hammasini bir holatga o'rnatish
  function markAll(status: AttendanceStatus) {
    setRows(prev => prev.map(r => ({ ...r, status, lateMinutes: status === 'late' ? 5 : 0 })));
  }

  async function handleSave() {
    if (!lessonId || rows.length === 0) return;
    setSaving(true);
    setError('');
    setDone(0);

    let saved = 0;
    for (const row of rows) {
      try {
        await api.post('/attendance/manual', {
          lessonId,
          studentId:   row.studentId,
          status:      row.status,
          ...(row.status === 'late' && row.lateMinutes > 0 && { lateMinutes: row.lateMinutes }),
          ...(row.status === 'excused' && row.excuseReason && { excuseReason: row.excuseReason }),
        });
        saved++;
        setDone(saved);
      } catch {
        // Individual xato — davom etamiz
      }
    }

    qc.invalidateQueries({ queryKey: ['lesson-attendance', lessonId] });
    qc.invalidateQueries({ queryKey: ['today-attendance'] });
    setSaving(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Qo'lda kiritish</h2>
            <p className="text-xs text-gray-400 mt-0.5">Guruh va dars tanlang, so'ng har o'quvchi holatini belgilang</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>

        {/* Guruh + Dars tanlash */}
        <div className="px-6 py-4 border-b border-gray-100 shrink-0 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Guruh</label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Barcha guruhlar</option>
              {groups?.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.subject ? ` — ${g.subject.name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Dars (bugungi)</label>
            <select
              value={lessonId}
              onChange={e => setLessonId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={groupLessons.length === 0}
            >
              <option value="">Tanlang</option>
              {groupLessons.map(l => (
                <option key={l.lesson.id} value={l.lesson.id}>
                  {l.lesson.group.name} — {l.lesson.startTime}–{l.lesson.endTime}
                </option>
              ))}
            </select>
            {groupLessons.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">Bugun bu guruhda dars yo'q</p>
            )}
          </div>
        </div>

        {/* O'quvchilar ro'yxati */}
        <div className="flex-1 overflow-y-auto">
          {!lessonId ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p className="text-sm">Dars tanlang</p>
            </div>
          ) : lessonLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <p className="text-sm">O'quvchilar topilmadi</p>
            </div>
          ) : (
            <div className="px-6 py-3">
              {/* Hammasini belgilash */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs text-gray-500 mr-1">Hammasi:</span>
                {STATUSES.map(s => (
                  <button key={s} onClick={() => markAll(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${STATUS_BTN[s]}`}>
                    {(() => { const I = STATUS_META[s].icon; return <I size={14} className="shrink-0" />; })()} {STATUS_META[s].label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400">{rows.length} ta o'quvchi</span>
              </div>

              {/* O'quvchi satrlari */}
              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div key={row.studentId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition">

                    {/* Ism */}
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {row.lastName} {row.firstName}
                      </p>
                    </div>

                    {/* Holat tugmalari */}
                    <div className="flex items-center gap-1 flex-wrap flex-1">
                      {STATUSES.map(s => (
                        <button key={s} onClick={() => setStatus(idx, s)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border transition ${
                            row.status === s
                              ? STATUS_BTN[s] + ' ring-1 ring-offset-1 ring-current'
                              : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                          }`}>
                          {(() => { const I = STATUS_META[s].icon; return <I size={14} className="shrink-0" />; })()}
                          <span className="hidden sm:inline ml-1">{STATUS_META[s].label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Kech daqiqa */}
                    {row.status === 'late' && (
                      <input
                        type="number" min={1} max={120}
                        value={row.lateMinutes || ''}
                        onChange={e => setLate(idx, parseInt(e.target.value) || 0)}
                        placeholder="daqiqa"
                        className="w-20 px-2 py-1 text-xs border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {saving && (
            <p className="text-emerald-600 text-xs mb-2">{done}/{rows.length} ta saqlandi...</p>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
              Bekor
            </button>
            <button onClick={handleSave}
              disabled={saving || !lessonId || rows.length === 0}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition">
              {saving ? `Saqlanmoqda... (${done}/${rows.length})` : `${rows.length} ta saqlash`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

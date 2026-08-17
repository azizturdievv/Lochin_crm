'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ScheduleLesson, ConflictResult } from '@/types/schedule';

interface ApiRoom     { id: string; name: string; number: string; capacity: number; isActive: boolean; orderIndex: number; }
interface ApiTimeSlot { id: string; name: string; startTime: string; endTime: string; isActive: boolean; orderIndex: number; }

interface Props {
  open:       boolean;
  onClose:    () => void;
  // Pre-fill (clicking empty slot)
  preDay?:    string;
  preRoom?:   string;
  preSlot?:   { start: string; end: string };
  // Edit mode
  lesson?:    ScheduleLesson | null;
}

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

type Mode = 'create' | 'edit';

export default function CreateLessonModal({ open, onClose, preDay, preRoom, preSlot, lesson }: Props) {
  const qc   = useQueryClient();
  const mode: Mode = lesson ? 'edit' : 'create';

  const [groupId,    setGroupId]    = useState('');
  const [teacherId,  setTeacherId]  = useState('');
  const [date,       setDate]       = useState(preDay ?? '');
  const [room,       setRoom]       = useState(preRoom ?? '101');
  const [startTime,  setStartTime]  = useState(preSlot?.start ?? '08:00');
  const [endTime,    setEndTime]    = useState(preSlot?.end   ?? '10:00');
  const [topic,      setTopic]      = useState('');
  const [recurring,  setRecurring]  = useState(false);
  const [recurWks,   setRecurWks]   = useState(12);
  const [conflict,   setConflict]   = useState<ConflictResult | null>(null);
  const [error,      setError]      = useState('');

  // Data
  const { data: groups }   = useQuery({ queryKey: ['groups-all'],   queryFn: () => api.get('/groups', { params: { isActive: 'true', limit: 200 } }).then(r => r.data.data ?? r.data), enabled: open });
  const { data: teachers } = useQuery({ queryKey: ['teachers-all'], queryFn: () => api.get('/users?role=ustoz').then(r => r.data.data ?? r.data), enabled: open });
  const { data: rooms }     = useQuery({ queryKey: ['rooms'],      queryFn: () => api.get<ApiRoom[]>('/schedule/rooms?active=true').then(r => r.data), enabled: open, staleTime: 5 * 60_000 });
  const { data: timeSlots } = useQuery({ queryKey: ['time-slots'], queryFn: () => api.get<ApiTimeSlot[]>('/schedule/time-slots?active=true').then(r => r.data), enabled: open, staleTime: 5 * 60_000 });

  useEffect(() => {
    if (!open) { setConflict(null); setError(''); return; }
    if (lesson) {
      setGroupId(lesson.group.id);
      setTeacherId(lesson.teacher.id);
      setDate(lesson.lessonDate);
      setRoom(lesson.roomNumber);
      // Backend "HH:MM:SS" qaytaradi (Postgres time turi) — inputlar va DTO
      // validatsiyasi "HH:MM" kutadi
      setStartTime(lesson.startTime.slice(0, 5));
      setEndTime(lesson.endTime.slice(0, 5));
      setTopic(lesson.topic ?? '');
    } else {
      setGroupId(''); setTeacherId('');
      setDate(preDay ?? ''); setRoom(preRoom ?? '101');
      setStartTime(preSlot?.start ?? '08:00');
      setEndTime(preSlot?.end   ?? '10:00');
      setTopic('');
    }
  }, [open, lesson, preDay, preRoom, preSlot]);

  // Konflikt tekshirish (debounced)
  useEffect(() => {
    if (!date || !startTime || !endTime || !room || !teacherId) { setConflict(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.post<ConflictResult>('/schedule/check-conflict', {
          lessonDate: date, startTime, endTime, roomNumber: room, teacherId,
          ...(lesson?.id && { excludeLessonId: lesson.id }),
        });
        setConflict(res.data);
      } catch { setConflict(null); }
    }, 500);
    return () => clearTimeout(t);
  }, [date, startTime, endTime, room, teacherId, lesson?.id]);

  const createMut = useMutation({
    mutationFn: (d: object) => api.post('/schedule/lesson', d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['week-schedule'] }); onClose(); },
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik'),
  });

  const editMut = useMutation({
    mutationFn: (d: object) => api.patch(`/schedule/lesson/${lesson!.id}`, d).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['week-schedule'] }); onClose(); },
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/schedule/lesson/${lesson!.id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['week-schedule'] }); onClose(); },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!groupId || !teacherId || !date || !room || !startTime || !endTime) {
      return setError('Barcha majburiy maydonlarni to\'ldiring');
    }
    if (mode === 'edit') {
      editMut.mutate({ teacherId, lessonDate: date, roomNumber: room, startTime, endTime, topic: topic || undefined });
    } else {
      createMut.mutate({ groupId, teacherId, lessonDate: date, roomNumber: room, startTime, endTime, topic: topic || undefined, recurring, recurringWeeks: recurWks });
    }
  }

  if (!open) return null;

  const isPending = createMut.isPending || editMut.isPending;
  const hasConflict = conflict?.hasConflict ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'edit' ? 'Darsni tahrirlash' : 'Yangi dars qo\'shish'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Guruh */}
          <div>
            <label className={LABEL}>Guruh *</label>
            <select value={groupId} onChange={e => setGroupId(e.target.value)} className={INPUT}>
              <option value="">Tanlang...</option>
              {(groups ?? []).map((g: { id: string; name: string; subject?: { name: string } }) => (
                <option key={g.id} value={g.id}>{g.name} {g.subject ? `— ${g.subject.name}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Ustoz */}
          <div>
            <label className={LABEL}>Ustoz *</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className={INPUT}>
              <option value="">Tanlang...</option>
              {(teachers ?? []).map((t: { id: string; firstName: string; lastName: string }) => (
                <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
              ))}
            </select>
          </div>

          {/* Sana + Xona */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Sana *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Xona *</label>
              <select value={room} onChange={e => setRoom(e.target.value)} className={INPUT}>
                {(rooms ?? []).map(r => (
                  <option key={r.id} value={r.number}>
                    {r.name} ({r.capacity} o'rin)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vaqt — para tanlash */}
          <div>
            <label className={LABEL}>Para vaqti *</label>
            <div className="grid grid-cols-2 gap-2">
              {(timeSlots ?? []).map(slot => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => { setStartTime(slot.startTime.slice(0, 5)); setEndTime(slot.endTime.slice(0, 5)); }}
                  className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                    startTime === slot.startTime.slice(0, 5)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {slot.name}: {slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>

          {/* Mavzu */}
          <div>
            <label className={LABEL}>Mavzu (ixtiyoriy)</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} className={INPUT} placeholder="Dars mavzusi..." />
          </div>

          {/* Takroriy (faqat yaratishda) */}
          {mode === 'create' && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="w-4 h-4 accent-primary-600" />
                <span className="text-sm text-gray-700">Takroriy dars (har hafta)</span>
              </label>
              {recurring && (
                <div className="flex items-center gap-3 pl-7">
                  <input
                    type="number" min={1} max={52} value={recurWks}
                    onChange={e => setRecurWks(parseInt(e.target.value))}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-500">hafta davomida</span>
                </div>
              )}
            </div>
          )}

          {/* Konflikt xabardorligi */}
          {conflict && (
            <div className={`rounded-xl p-3 text-sm ${hasConflict ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
              {hasConflict ? (
                <>
                  <p className="font-medium">Konflikt aniqlandi</p>
                  {conflict.roomConflict && <p className="text-xs mt-1">Xona band: {conflict.roomConflict.group?.name}</p>}
                  {conflict.teacherConflict && <p className="text-xs mt-1">Ustoz band: {conflict.teacherConflict.group?.name}</p>}
                </>
              ) : (
                <p className="font-medium">Xona va ustoz bo'sh</p>
              )}
            </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-2 pt-1">
            {mode === 'edit' && (
              <button type="button" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
                className="px-4 py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition disabled:opacity-60">
                Bekor
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Yopish
            </button>
            <button type="submit" disabled={isPending || hasConflict}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
              {isPending ? 'Saqlanmoqda...' : mode === 'edit' ? 'Saqlash' : '+ Qo\'shish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

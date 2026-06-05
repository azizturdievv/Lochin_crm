'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ScheduleLesson } from '@/types/schedule';

interface Props {
  lesson:  ScheduleLesson | null;
  onClose: () => void;
}

const REASON_OPTIONS = [
  { value: 'sick',     label: '🤒 Kasal' },
  { value: 'personal', label: '👤 Shaxsiy sabab' },
  { value: 'family',   label: '👪 Oilaviy' },
  { value: 'training', label: '📚 Treening/Malaka oshirish' },
  { value: 'other',    label: '📌 Boshqa' },
];

export default function SubstituteModal({ lesson, onClose }: Props) {
  const qc = useQueryClient();
  const [substituteId, setSubstituteId] = useState('');
  const [reason,       setReason]       = useState('sick');
  const [notes,        setNotes]        = useState('');
  const [error,        setError]        = useState('');

  const { data: teachers } = useQuery({
    queryKey: ['teachers-all'],
    queryFn:  () => api.get('/users?role=ustoz&isActive=true').then(r => r.data.data ?? r.data),
    enabled:  !!lesson,
  });

  const createMut = useMutation({
    mutationFn: (d: object) => api.post('/substitutions', d).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week-schedule'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  if (!lesson) return null;

  const availableTeachers = (teachers ?? []).filter(
    (t: { id: string }) => t.id !== lesson.teacher.id,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!substituteId) return setError('O\'rinbosar ustoz tanlang');
    createMut.mutate({
      lessonId:            lesson!.id,
      substituteTeacherId: substituteId,
      reason,
      notes: notes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">🔄 O'rinbosar tayinlash</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {lesson.group.name} — {lesson.startTime}–{lesson.endTime}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Joriy ustoz */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-600 mb-0.5">Joriy ustoz:</p>
            <p className="text-sm font-semibold text-amber-900">
              {lesson.teacher.lastName} {lesson.teacher.firstName}
            </p>
          </div>

          {/* O'rinbosar ustoz */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">O'rinbosar ustoz *</label>
            <select value={substituteId} onChange={e => setSubstituteId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="">Tanlang...</option>
              {availableTeachers.map((t: { id: string; firstName: string; lastName: string }) => (
                <option key={t.id} value={t.id}>{t.lastName} {t.firstName}</option>
              ))}
            </select>
          </div>

          {/* Sabab */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Sabab *</label>
            <div className="grid grid-cols-1 gap-1.5">
              {REASON_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setReason(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all text-left ${
                    reason === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Izoh (ixtiyoriy)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              placeholder="Qo'shimcha ma'lumot..." />
          </div>

          {/* Maosh haqida info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
            💡 O'rinbosar maoshi avtomatik hisoblanadi va xodimlar ish haqiga qo'shiladi.
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition">
              {createMut.isPending ? 'Tayinlanmoqda...' : '✓ Tayinlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

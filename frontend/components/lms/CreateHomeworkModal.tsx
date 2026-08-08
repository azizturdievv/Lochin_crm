'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LessonOption } from '@/types/lms';

interface Props {
  groupId: string;
  onClose: () => void;
}

// Mahalliy sana qatori — toISOString() UTC+5'da bir kun orqaga surib yuborardi
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return toLocalDateStr(d);
}

export default function CreateHomeworkModal({ groupId, onClose }: Props) {
  const qc = useQueryClient();

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ['homework-lessons', groupId],
    queryFn:  () => api.get<LessonOption[]>(`/homework/lessons/${groupId}`).then(r => r.data),
  });

  const [lessonId,    setLessonId]    = useState('');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [dueDate,     setDueDate]     = useState(defaultDueDate);
  const [maxScore,    setMaxScore]    = useState(100);
  const [error,       setError]       = useState('');

  // Darslar yuklangach eng so'nggisi avtomatik tanlanadi
  const effectiveLessonId = lessonId || lessons[0]?.id || '';

  const createMut = useMutation({
    mutationFn: () => api.post('/homework', {
      lessonId: effectiveLessonId,
      groupId,
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate,
      maxScore,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homeworks', groupId] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Vazifa yaratishda xatolik yuz berdi'),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim())      { setError('Sarlavha kiritilishi shart'); return; }
    if (!effectiveLessonId) { setError('Dars tanlang'); return; }
    if (!dueDate)           { setError('Muddat kiritilishi shart'); return; }
    createMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Yangi vazifa</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Dars tanlash */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Dars *</label>
            {lessonsLoading ? (
              <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ) : lessons.length === 0 ? (
              <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">
                Bu guruhda hali dars yo'q — avval jadvalga dars qo'shing
              </p>
            ) : (
              <select
                value={effectiveLessonId}
                onChange={e => setLessonId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {lessons.map(l => (
                  <option key={l.id} value={l.id}>
                    {new Date(l.lessonDate).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' })} · {l.startTime.slice(0, 5)}–{l.endTime.slice(0, 5)}
                    {l.topic ? ` — ${l.topic}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sarlavha */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sarlavha *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Vazifa nomi"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Tavsif */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Tavsif (ixtiyoriy)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Vazifa tafsilotlari..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Muddat + Ball */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Muddat *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Maksimal ball</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxScore}
                onChange={e => setMaxScore(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Tugmalar */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
          <button
            onClick={handleSubmit}
            disabled={createMut.isPending || lessons.length === 0}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {createMut.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CrmEvent, EventQuestion } from '@/types/events';

interface Props {
  event: CrmEvent;
}

const EMPTY_OPTIONS = ['', '', '', ''];

export default function QuestionsTab({ event }: Props) {
  const qc = useQueryClient();
  const [adding,  setAdding]  = useState(false);
  const [qText,   setQText]   = useState('');
  const [options, setOptions] = useState<string[]>(EMPTY_OPTIONS);
  const [correct, setCorrect] = useState(0);
  const [points,  setPoints]  = useState('1');
  const [error,   setError]   = useState('');

  const canEdit = event.competitionStatus === 'not_started';

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['event-questions', event.id],
    queryFn:  () => api.get<EventQuestion[]>(`/events/${event.id}/questions`).then(r => r.data),
  });

  const addMut = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/questions`, {
      question:      qText.trim(),
      options:       options.map((text, i) => ({ id: String(i), text: text.trim() })),
      correctAnswer: String(correct),
      points:        +points || 1,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-questions', event.id] });
      setQText(''); setOptions(EMPTY_OPTIONS); setCorrect(0); setPoints('1');
      setAdding(false);
      setError('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const removeMut = useMutation({
    mutationFn: (questionId: string) => api.delete(`/events/${event.id}/questions/${questionId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-questions', event.id] }),
  });

  function handleAdd() {
    setError('');
    if (!qText.trim()) return setError('Savol matni kiritilishi shart');
    if (options.some(o => !o.trim())) return setError('Barcha 4 variant to\'ldirilishi shart');
    addMut.mutate();
  }

  function updateOption(i: number, value: string) {
    setOptions(prev => prev.map((o, idx) => (idx === i ? value : o)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {questions.length} ta savol
          {questions.length < event.questionCount && (
            <span className="text-amber-600 ml-2">
              — kamida {event.questionCount} ta kerak (har ishtirokchiga shuncha tasodifiy chiqadi)
            </span>
          )}
        </p>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="shrink-0 flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-xl font-medium transition-colors"
          >
            <Plus size={14} /> Savol qo'shish
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Musobaqa boshlangan/tugagan — savollarni tahrirlab bo'lmaydi
        </p>
      )}

      {adding && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <textarea
            value={qText}
            onChange={e => setQText(e.target.value)}
            placeholder="Savol matnini kiriting..."
            rows={2}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none bg-white"
          />

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Javob variantlari (to'g'risini belgilang)</label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrect(i)}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    correct === i ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-emerald-400'
                  }`}
                >
                  {correct === i && <span className="w-2 h-2 rounded-full bg-white" />}
                </button>
                <input
                  value={opt}
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Variant ${i + 1}`}
                  className={`flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white ${
                    correct === i ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Ball:</label>
            <input
              type="number" min={1} max={10} value={points}
              onChange={e => setPoints(e.target.value)}
              className="w-16 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAdding(false); setError(''); }}
              className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Bekor
            </button>
            <button
              onClick={handleAdd}
              disabled={addMut.isPending}
              className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {addMut.isPending ? 'Saqlanmoqda...' : "Qo'shish"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">Savollar yo'q</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{i + 1}. {q.question}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {q.options.map(opt => (
                      <span
                        key={opt.id}
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          opt.id === q.correctAnswer
                            ? 'bg-emerald-100 text-emerald-700 font-medium'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {opt.text}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">{q.points} ball</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => confirm("Savolni o'chirishni tasdiqlaysizmi?") && removeMut.mutate(q.id)}
                    className="shrink-0 text-gray-400 hover:text-red-500 w-6 h-6 rounded flex items-center justify-center transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TestDifficulty } from '@/types/lms';
import { DIFFICULTY_META } from '@/types/lms';

interface Props {
  subjectId: string;
  groupId:   string | null;
  onClose:   () => void;
}

interface QuestionDraft {
  text:       string;
  options:    string[];
  correct:    number;
  difficulty: TestDifficulty;
}

function emptyQuestion(): QuestionDraft {
  return { text: '', options: ['', '', '', ''], correct: 0, difficulty: 'medium' };
}

export default function CreateTestModal({ subjectId, groupId, onClose }: Props) {
  const qc = useQueryClient();

  const [title,     setTitle]     = useState('');
  const [duration,  setDuration]  = useState(30);
  const [passScore, setPassScore] = useState(60);
  const [dueDate,   setDueDate]   = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [error,     setError]     = useState('');
  const [activeQ,   setActiveQ]   = useState(0);

  const createMut = useMutation({
    mutationFn: () => api.post('/lms/tests', {
      subjectId,
      groupId: groupId ?? undefined,
      title,
      durationMinutes: duration,
      passScore,
      dueDate: dueDate || undefined,
      questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] });
      onClose();
    },
    onError: () => setError("Saqlashda xatolik yuz berdi"),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim()) { setError("Sarlavha kiritilishi shart"); return; }
    if (questions.length < 5) { setError("Kamida 5 ta savol kerak"); return; }
    const invalid = questions.findIndex(q =>
      !q.text.trim() || q.options.some(o => !o.trim())
    );
    if (invalid >= 0) {
      setError(`${invalid + 1}-savol to'ldirilmagan`);
      setActiveQ(invalid);
      return;
    }
    createMut.mutate();
  }

  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  function updateOption(qi: number, oi: number, val: string) {
    setQuestions(qs => qs.map((q, idx) =>
      idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q
    ));
  }

  function addQuestion() {
    setQuestions(qs => [...qs, emptyQuestion()]);
    setActiveQ(questions.length);
  }

  function removeQuestion(i: number) {
    if (questions.length <= 1) return;
    setQuestions(qs => qs.filter((_, idx) => idx !== i));
    setActiveQ(Math.min(i, questions.length - 2));
  }

  const diffCounts = (['easy', 'medium', 'hard'] as const).map(d => ({
    d, count: questions.filter(q => q.difficulty === d).length,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">✏️ Test draft yaratish</h2>
            <p className="text-xs text-gray-400 mt-0.5">Saqlangach manager tekshiruviga ketadi</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Chap: sozlamalar + savol ro'yxati */}
          <div className="w-56 shrink-0 border-r border-gray-100 flex flex-col">
            <div className="p-4 space-y-3 border-b border-gray-100">
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase mb-1 block">Sarlavha</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Test nomi"
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">Daqiqa</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={duration}
                    onChange={e => setDuration(+e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">O'tish %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={passScore}
                    onChange={e => setPassScore(+e.target.value)}
                    className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 mb-1 block">Muddat</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Daraja statistika */}
              <div className="flex gap-1.5 flex-wrap">
                {diffCounts.map(({ d, count }) => count > 0 ? (
                  <span key={d} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_META[d].bg} ${DIFFICULTY_META[d].color}`}>
                    {DIFFICULTY_META[d].label[0]}: {count}
                  </span>
                ) : null)}
              </div>
            </div>

            {/* Savol ro'yxati */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setActiveQ(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                    activeQ === i
                      ? 'bg-emerald-50 text-emerald-800 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${DIFFICULTY_META[q.difficulty].bg} ${DIFFICULTY_META[q.difficulty].color}`}>
                    {i + 1}
                  </span>
                  <span className="truncate">{q.text || 'Savol...'}</span>
                </button>
              ))}
              <button
                onClick={addQuestion}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
              >
                + Savol qo'shish
              </button>
            </div>
          </div>

          {/* O'ng: savol tahrirlash */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {questions[activeQ] && (() => {
              const q = questions[activeQ];
              return (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{activeQ + 1}-savol</h3>
                    <div className="flex items-center gap-2">
                      {/* Daraja */}
                      <div className="flex gap-1">
                        {(['easy', 'medium', 'hard'] as const).map(d => (
                          <button
                            key={d}
                            onClick={() => updateQuestion(activeQ, { difficulty: d })}
                            className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-colors ${
                              q.difficulty === d
                                ? `${DIFFICULTY_META[d].bg} ${DIFFICULTY_META[d].color}`
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {DIFFICULTY_META[d].label}
                          </button>
                        ))}
                      </div>
                      {questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(activeQ)}
                          className="text-gray-400 hover:text-red-500 text-xs w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Savol matni */}
                  <textarea
                    value={q.text}
                    onChange={e => updateQuestion(activeQ, { text: e.target.value })}
                    placeholder="Savol matnini kiriting..."
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />

                  {/* Variantlar */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600">Javob variantlari (to'g'risini belgilang)</label>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuestion(activeQ, { correct: oi })}
                          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            q.correct === oi
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {q.correct === oi && <span className="w-2 h-2 rounded-full bg-white" />}
                        </button>
                        <input
                          value={opt}
                          onChange={e => updateOption(activeQ, oi, e.target.value)}
                          placeholder={`Variant ${oi + 1}`}
                          className={`flex-1 px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                            q.correct === oi ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Pastki panel */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 gap-3">
          <div className="text-xs text-gray-500">
            {questions.length} ta savol
            {questions.length < 5 && (
              <span className="text-amber-600 ml-2">— kamida 5 ta kerak</span>
            )}
          </div>
          {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending}
              className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {createMut.isPending ? 'Saqlanmoqda...' : '📤 Tekshiruvga yuborish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

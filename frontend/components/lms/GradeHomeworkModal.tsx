'use client';

import { X, FileText, Pencil, Check } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/date';
import type { HomeworkSubmissionsResponse, HomeworkSubmission } from '@/types/lms';

interface Props {
  homeworkId: string;
  onClose:    () => void;
}

export default function GradeHomeworkModal({ homeworkId, onClose }: Props) {
  const qc = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [score,     setScore]     = useState('');
  const [comment,   setComment]   = useState('');
  const [error,     setError]     = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['homework-submissions', homeworkId],
    queryFn:  () => api.get<HomeworkSubmissionsResponse>(`/homework/${homeworkId}/submissions`).then(r => r.data),
  });

  const gradeMut = useMutation({
    mutationFn: ({ submissionId, score: s, teacherComment }: { submissionId: string; score: number; teacherComment: string }) =>
      api.post('/homework/grade', { submissionId, score: s, teacherComment: teacherComment.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework-submissions', homeworkId] });
      qc.invalidateQueries({ queryKey: ['homeworks'] });
      setEditingId(null);
      setError('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Baholashda xatolik yuz berdi'),
  });

  function startEdit(sub: HomeworkSubmission) {
    setEditingId(sub.id);
    setScore(sub.score != null ? String(sub.score) : '');
    setComment(sub.teacherComment ?? '');
    setError('');
  }

  function save(submissionId: string, maxScore: number) {
    const n = Number(score);
    if (!score.trim() || Number.isNaN(n) || n < 0 || n > maxScore) {
      setError(`Ball 0 dan ${maxScore} gacha bo'lishi kerak`);
      return;
    }
    gradeMut.mutate({ submissionId, score: n, teacherComment: comment });
  }

  const homework   = data?.homework;
  const stats      = data?.stats;
  const submissions = data?.submissions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">{homework?.title ?? 'Vazifa'}</h2>
            {stats && (
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.total} topshirdi · {stats.onTime} vaqtida · {stats.late} kech · {stats.graded} baholandi
                {stats.avgScore > 0 && ` · o'rtacha ${stats.avgScore}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors shrink-0"><X size={16} /></button>
        </div>

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
              <p className="text-sm">Hali hech kim topshirmagan</p>
            </div>
          ) : (
            submissions.map(sub => {
              const isEditing = editingId === sub.id;
              const graded    = sub.score != null;
              return (
                <div key={sub.id} className={`border rounded-2xl px-4 py-3 ${graded ? 'border-emerald-100 bg-emerald-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {sub.student ? `${sub.student.firstName} ${sub.student.lastName}` : 'O\'quvchi'}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          sub.isLate ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sub.isLate ? 'Kech' : "O'z vaqtida"}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatDateTime(sub.submittedAt)}</span>
                      </div>

                      {sub.content && (
                        <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{sub.content}</p>
                      )}
                      {sub.fileUrls.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1.5">
                          {sub.fileUrls.map((url, i) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              <FileText size={12} /> Fayl{sub.fileUrls.length > 1 ? ` ${i + 1}` : ''}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="shrink-0 flex flex-col items-end gap-1.5">
                        {graded && (
                          <span className="text-sm font-bold text-emerald-700">
                            {Number(sub.score)}/{homework?.maxScore}
                          </span>
                        )}
                        <button
                          onClick={() => startEdit(sub)}
                          className="text-xs flex items-center gap-1 text-primary-600 bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        >
                          {graded ? <><Pencil size={11} /> Tahrirlash</> : <><Check size={11} /> Baholash</>}
                        </button>
                      </div>
                    )}
                  </div>

                  {graded && !isEditing && sub.teacherComment && (
                    <p className="text-xs text-gray-600 mt-2 bg-white rounded-lg px-3 py-2">{sub.teacherComment}</p>
                  )}

                  {isEditing && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={homework?.maxScore ?? 100}
                          value={score}
                          onChange={e => setScore(e.target.value)}
                          placeholder={`0-${homework?.maxScore ?? 100}`}
                          className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-xs text-gray-400">/ {homework?.maxScore} ball</span>
                      </div>
                      <textarea
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Izoh (ixtiyoriy)"
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingId(null); setError(''); }}
                          className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                        >
                          Bekor
                        </button>
                        <button
                          onClick={() => save(sub.id, homework?.maxScore ?? 100)}
                          disabled={gradeMut.isPending}
                          className="px-4 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
                        >
                          {gradeMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  );
}

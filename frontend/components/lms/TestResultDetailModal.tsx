'use client';

import { X, Check, XCircle, Archive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { DIFFICULTY_META } from '@/types/lms';
import type { TestResultDetailResponse } from '@/types/lms';

interface Props {
  resultId: string;
  onClose:  () => void;
}

export default function TestResultDetailModal({ resultId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['test-result-detail', resultId],
    queryFn:  () => api.get<TestResultDetailResponse>(`/tests/results/${resultId}/detail`).then(r => r.data),
  });

  const result    = data?.result;
  const questions = data?.questions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate flex items-center gap-2">
              {result?.student ? `${result.student.firstName} ${result.student.lastName}` : "O'quvchi topilmadi"}
              {result?.student?.archived && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  <Archive size={10} /> Arxivlangan
                </span>
              )}
            </h2>
            {result && (
              <p className="text-xs text-gray-400 mt-0.5">
                {result.attemptNumber}-urinish · {result.earnedPoints}/{result.totalPoints} ball · {result.score.toFixed(0)}%
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors shrink-0"><X size={16} /></button>
        </div>

        {/* Savollar ro'yxati */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : questions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Savollar topilmadi</p>
          ) : (
            questions.map((q, i) => (
              <div
                key={q.id}
                className={`border rounded-2xl px-4 py-3 ${q.isCorrect ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {q.isCorrect ? (
                      <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium text-gray-900">{i + 1}. {q.question}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {q.topic && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                        {q.topic}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_META[q.difficulty].bg} ${DIFFICULTY_META[q.difficulty].color}`}>
                      {DIFFICULTY_META[q.difficulty].label}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 ml-6">
                  {q.options.map(opt => {
                    const isCorrectOpt = opt.id === q.correctAnswer;
                    const isStudentPick = opt.id === q.studentAnswer;
                    return (
                      <div
                        key={opt.id}
                        className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 ${
                          isCorrectOpt
                            ? 'bg-emerald-100 text-emerald-800 font-medium'
                            : isStudentPick
                              ? 'bg-red-100 text-red-700 font-medium'
                              : 'text-gray-500'
                        }`}
                      >
                        <span>{opt.text}</span>
                        <span className="shrink-0 text-[10px]">
                          {isCorrectOpt && "✓ To'g'ri javob"}
                          {isStudentPick && !isCorrectOpt && "O'quvchi shuni tanladi"}
                        </span>
                      </div>
                    );
                  })}
                  {q.studentAnswer === null && (
                    <p className="text-[10px] text-gray-400 italic">Javob berilmagan</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

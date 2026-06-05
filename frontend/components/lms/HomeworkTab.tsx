'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Homework, HomeworkSubmission } from '@/types/lms';

interface Props {
  subjectId:   string;
  groupId:     string | null;
  canCreate:   boolean;
  studentId:   string | null;
}

type HwFilter = 'all' | 'active' | 'submitted' | 'graded' | 'late';

const FILTERS: Array<{ v: HwFilter; label: string; icon: string }> = [
  { v: 'all',       label: 'Barchasi',  icon: '📋' },
  { v: 'active',    label: 'Bajarish',  icon: '🔴' },
  { v: 'submitted', label: 'Topshirildi',icon: '✅' },
  { v: 'graded',    label: 'Baholandi', icon: '⭐' },
  { v: 'late',      label: 'Kechikdi',  icon: '⏰' },
];

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function HomeworkTab({ subjectId, groupId, canCreate, studentId }: Props) {
  const qc             = useQueryClient();
  const [filter,       setFilter]        = useState<HwFilter>('all');
  const [submitId,     setSubmitId]       = useState<string | null>(null);
  const [submitText,   setSubmitText]     = useState('');
  const [submitFile,   setSubmitFile]     = useState<File | null>(null);
  const [uploading,    setUploading]      = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['homeworks', subjectId, groupId],
    queryFn:  () => api.get<Homework[]>('/lms/homework', {
      params: { subjectId, groupId: groupId ?? undefined },
    }).then(r => r.data),
  });

  const submitMut = useMutation({
    mutationFn: async ({ hwId }: { hwId: string }) => {
      const form = new FormData();
      if (submitText.trim()) form.append('text', submitText.trim());
      if (submitFile)        form.append('file', submitFile);
      return api.post(`/lms/homework/${hwId}/submit`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homeworks', subjectId, groupId] });
      setSubmitId(null);
      setSubmitText('');
      setSubmitFile(null);
    },
  });

  const gradeMut = useMutation({
    mutationFn: ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback: string }) =>
      api.patch(`/lms/homework/submissions/${submissionId}/grade`, { score, feedback }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homeworks', subjectId, groupId] }),
  });

  function hwStatus(hw: Homework): HwFilter {
    if (!hw.mySubmission) {
      return daysLeft(hw.dueDate) < 0 ? 'late' : 'active';
    }
    if (hw.mySubmission.score != null) return 'graded';
    if (hw.mySubmission.isLate)        return 'late';
    return 'submitted';
  }

  const filtered = filter === 'all'
    ? homeworks
    : homeworks.filter(hw => hwStatus(hw) === filter);

  return (
    <div className="space-y-4">
      {/* Filtr */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => {
          const cnt = f.v === 'all'
            ? homeworks.length
            : homeworks.filter(hw => hwStatus(hw) === f.v).length;
          return (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                filter === f.v
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.icon} {f.label}
              {cnt > 0 && <span className={`ml-1 text-[10px] font-bold px-1 rounded-full ${filter === f.v ? 'bg-white/20' : 'bg-gray-100'}`}>{cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* Ro'yxat */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl">📚</div>
          <p className="text-sm">Vazifalar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(hw => {
            const status = hwStatus(hw);
            const days   = daysLeft(hw.dueDate);
            const sub    = hw.mySubmission;

            return (
              <div
                key={hw.id}
                className={`bg-white border rounded-2xl px-5 py-4 transition-all ${
                  status === 'active' && days <= 1
                    ? 'border-red-200 bg-red-50/30'
                    : status === 'graded'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{hw.title}</h3>
                      {/* Streak */}
                      {hw.streak && hw.streak > 1 && (
                        <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                          🔥 {hw.streak} ketma-ket
                        </span>
                      )}
                    </div>

                    {hw.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{hw.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                      {/* Deadline */}
                      <span className={`font-medium ${
                        days < 0 ? 'text-red-600' :
                        days <= 1 ? 'text-amber-600' :
                        'text-gray-500'
                      }`}>
                        📅 {days < 0 ? `${Math.abs(days)} kun o'tib ketdi` :
                           days === 0 ? 'Bugun muddat!' :
                           `${days} kun qoldi`}
                      </span>
                      <span className="text-gray-400">⭐ Maks: {hw.maxScore} ball</span>
                      {hw.creator && (
                        <span className="text-gray-400">👤 {hw.creator.firstName} {hw.creator.lastName[0]}.</span>
                      )}
                    </div>

                    {/* Topshirilgan javob */}
                    {sub && (
                      <div className={`mt-3 px-3 py-2 rounded-xl text-xs ${
                        sub.score != null ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100'
                      }`}>
                        {sub.score != null ? (
                          <div>
                            <span className="font-semibold text-emerald-700">
                              ⭐ Ball: {sub.score}/{hw.maxScore}
                            </span>
                            {sub.feedback && (
                              <p className="text-gray-600 mt-1">{sub.feedback}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">
                            ✅ Topshirildi · {sub.isLate ? '⏰ Kech' : 'O\'z vaqtida'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tugmalar */}
                  <div className="shrink-0 flex flex-col gap-2">
                    {hw.fileUrl && (
                      <a
                        href={hw.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors text-center"
                      >
                        📎 Fayl
                      </a>
                    )}
                    {!sub && status !== 'late' && studentId && (
                      <button
                        onClick={() => setSubmitId(submitId === hw.id ? null : hw.id)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium"
                      >
                        ✏️ Topshirish
                      </button>
                    )}
                  </div>
                </div>

                {/* Topshirish formasi */}
                {submitId === hw.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <textarea
                      value={submitText}
                      onChange={e => setSubmitText(e.target.value)}
                      placeholder="Javob yozing yoki fayl yuklang..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        {submitFile ? `📎 ${submitFile.name}` : '📎 Fayl biriktirish'}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        onChange={e => setSubmitFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        onClick={() => submitMut.mutate({ hwId: hw.id })}
                        disabled={submitMut.isPending || (!submitText.trim() && !submitFile)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl disabled:opacity-50 transition-colors font-medium ml-auto"
                      >
                        {submitMut.isPending ? 'Yuborilmoqda...' : '✓ Yuborish'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

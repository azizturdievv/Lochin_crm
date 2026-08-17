'use client';

import { BookOpen, CheckCircle2, ClipboardList, Clock, PenLine, Pencil, Plus, Star, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Homework } from '@/types/lms';
import CreateHomeworkModal from './CreateHomeworkModal';
import GradeHomeworkModal from './GradeHomeworkModal';

interface Props {
  groupId:     string | null;
  canCreate:   boolean;
  studentId:   string | null;
}

type HwFilter = 'all' | 'active' | 'submitted' | 'graded' | 'late';

const FILTERS: Array<{ v: HwFilter; label: string; icon: LucideIcon }> = [
  { v: 'all',       label: 'Barchasi',  icon: ClipboardList },
  { v: 'active',    label: 'Bajarish',  icon: PenLine },
  { v: 'submitted', label: 'Topshirildi',icon: CheckCircle2 },
  { v: 'graded',    label: 'Baholandi', icon: Star },
  { v: 'late',      label: 'Kechikdi',  icon: Clock },
];

// Kalendar-kun farqi — soat qismi hisobga olinmaydi, shu bilan backenddagi
// "muddat kunining oxirigacha vaqtida" qoidasi bilan mos keladi (0 — bugun
// muddat, hali kech emas; -1 va undan kichik — muddat o'tgan).
function daysLeft(iso: string): number {
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomeworkTab({ groupId, canCreate, studentId }: Props) {
  const qc             = useQueryClient();
  const [filter,       setFilter]        = useState<HwFilter>('all');
  const [submitId,     setSubmitId]       = useState<string | null>(null);
  const [submitText,   setSubmitText]     = useState('');
  const [submitFile,   setSubmitFile]     = useState<File | null>(null);
  const [uploading,    setUploading]      = useState(false);
  const [submitError,  setSubmitError]    = useState('');
  const [createOpen,   setCreateOpen]     = useState(false);
  const [gradingId,    setGradingId]      = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['homeworks', groupId],
    queryFn:  () => api.get<Homework[]>(`/homework/group/${groupId}`).then(r => r.data),
    enabled:  !!groupId,
  });

  const submitMut = useMutation({
    mutationFn: async ({ hwId }: { hwId: string }) => {
      if (submitFile) {
        const form = new FormData();
        if (submitText.trim()) form.append('content', submitText.trim());
        form.append('file', submitFile);
        return api.post(`/homework/${hwId}/submit/file`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return api.post(`/homework/${hwId}/submit`, { content: submitText.trim() || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homeworks', groupId] });
      setSubmitId(null);
      setSubmitText('');
      setSubmitFile(null);
      setSubmitError('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setSubmitError(e.response?.data?.message ?? 'Yuborishda xatolik yuz berdi'),
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
      {/* Filtr + Yangi vazifa */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
                    ? 'bg-primary-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <f.icon size={14} className="shrink-0" /> {f.label}
                {cnt > 0 && <span className={`ml-1 text-[10px] font-bold px-1 rounded-full ${filter === f.v ? 'bg-white/20' : 'bg-gray-100'}`}>{cnt}</span>}
              </button>
            );
          })}
        </div>
        {canCreate && groupId && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Plus size={14} /> Yangi vazifa
          </button>
        )}
      </div>

      {/* Ro'yxat */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl"><BookOpen size={36} /></div>
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
                        {days < 0 ? `${Math.abs(days)} kun o'tib ketdi` :
                           days === 0 ? 'Bugun muddat!' :
                           `${days} kun qoldi`}
                      </span>
                      <span className="text-gray-400">Maks: {hw.maxScore} ball</span>
                    </div>

                    {/* Topshirilgan javob */}
                    {sub && (
                      <div className={`mt-3 px-3 py-2 rounded-xl text-xs ${
                        sub.score != null ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50 border border-gray-100'
                      }`}>
                        {sub.score != null ? (
                          <div>
                            <span className="font-semibold text-emerald-700">
                              Ball: {Number(sub.score)}/{hw.maxScore}
                            </span>
                            {sub.teacherComment && (
                              <p className="text-gray-600 mt-1">{sub.teacherComment}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">
                            Topshirildi · {sub.isLate ? 'Kech' : 'O\'z vaqtida'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tugmalar */}
                  <div className="shrink-0 flex flex-col gap-2">
                    {canCreate && (
                      <button
                        onClick={() => setGradingId(hw.id)}
                        className="text-xs flex items-center gap-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                      >
                        <ClipboardCheck size={14} /> Baholash
                      </button>
                    )}
                    {hw.attachmentUrls.map((url, i) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors text-center"
                      >
                        Fayl{hw.attachmentUrls.length > 1 ? ` ${i + 1}` : ''}
                      </a>
                    ))}
                    {!sub && status !== 'late' && studentId && (
                      <button
                        onClick={() => setSubmitId(submitId === hw.id ? null : hw.id)}
                        className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium"
                      >
                        <Pencil size={14} /> Topshirish
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
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        {submitFile ? `${submitFile.name}` : 'Fayl biriktirish'}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        onChange={e => setSubmitFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        onClick={() => { setSubmitError(''); submitMut.mutate({ hwId: hw.id }); }}
                        disabled={submitMut.isPending || (!submitText.trim() && !submitFile)}
                        className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-xl disabled:opacity-50 transition-colors font-medium ml-auto"
                      >
                        {submitMut.isPending ? 'Yuborilmoqda...' : 'Yuborish'}
                      </button>
                    </div>
                    {submitError && (
                      <p className="text-xs text-red-600">{submitError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {createOpen && groupId && (
        <CreateHomeworkModal groupId={groupId} onClose={() => setCreateOpen(false)} />
      )}

      {gradingId && (
        <GradeHomeworkModal homeworkId={gradingId} onClose={() => setGradingId(null)} />
      )}
    </div>
  );
}

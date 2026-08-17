'use client';

import { X, Lock } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { BASELINE_TYPE_META, isBaselineSealed } from '@/types/lms';
import type { BaselineType, BaselineAssessment } from '@/types/lms';

interface Props {
  studentId: string;
  subjectId: string;
  existing: BaselineAssessment[]; // shu o'quvchi + fan bo'yicha mavjud yozuvlar (barcha turlar)
  onClose: () => void;
}

const TYPES: BaselineType[] = ['test', 'oral', 'creative', 'sport', 'custom'];

export default function CreateBaselineModal({ studentId, subjectId, existing, onClose }: Props) {
  const qc = useQueryClient();

  const [type,         setType]         = useState<BaselineType>('test');
  const [score,        setScore]        = useState('');
  const [teacherScore, setTeacherScore] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [runTimeSec,   setRunTimeSec]   = useState('');
  const [jumpCm,       setJumpCm]       = useState('');
  const [file,         setFile]         = useState<File | null>(null);
  const [error,        setError]        = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const existingForType = existing.find(b => b.type === type) ?? null;
  const sealed = existingForType ? isBaselineSealed(existingForType) : false;

  // Tur almashganda — mavjud (muhrlanmagan) yozuv bo'lsa, maydonlarni shu bilan to'ldirish
  useEffect(() => {
    setError('');
    setFile(null);
    if (existingForType && !isBaselineSealed(existingForType)) {
      setScore(existingForType.score != null ? String(existingForType.score) : '');
      setTeacherScore(existingForType.teacherScore != null ? String(existingForType.teacherScore) : '');
      setTeacherNotes(existingForType.teacherNotes ?? '');
      setRunTimeSec(existingForType.sportData?.runTimeSec != null ? String(existingForType.sportData.runTimeSec) : '');
      setJumpCm(existingForType.sportData?.jumpCm != null ? String(existingForType.sportData.jumpCm) : '');
    } else {
      setScore('');
      setTeacherScore('');
      setTeacherNotes('');
      setRunTimeSec('');
      setJumpCm('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('studentId', studentId);
      form.append('subjectId', subjectId);
      form.append('type', type);
      if (score.trim())        form.append('score', score.trim());
      if (teacherScore.trim()) form.append('teacherScore', teacherScore.trim());
      if (teacherNotes.trim()) form.append('teacherNotes', teacherNotes.trim());
      if (type === 'sport' && (runTimeSec.trim() || jumpCm.trim())) {
        const sportData: Record<string, number> = {};
        if (runTimeSec.trim()) sportData.runTimeSec = Number(runTimeSec);
        if (jumpCm.trim())     sportData.jumpCm = Number(jumpCm);
        form.append('sportData', JSON.stringify(sportData));
      }
      if (file) form.append('file', file);

      return api.post('/baseline', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baselines', studentId] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Saqlashda xatolik yuz berdi');
    },
  });

  function handleSubmit() {
    setError('');
    if (sealed) { setError("Bu tur allaqachon muhrlangan — o'zgartirib bo'lmaydi"); return; }

    const hasAnyValue =
      score.trim() || teacherScore.trim() || teacherNotes.trim() ||
      runTimeSec.trim() || jumpCm.trim() || file;
    if (!hasAnyValue) { setError("Kamida bitta baho, izoh yoki fayl kiriting"); return; }

    saveMut.mutate();
  }

  const fileAccept = type === 'oral' ? 'audio/*' : type === 'creative' ? 'image/*,.pdf' : '*';
  const showFile   = type === 'oral' || type === 'creative' || type === 'custom';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Ilk qabul baholash</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Tur tanlash */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Baholash turi</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(t => {
                const meta = BASELINE_TYPE_META[t];
                const already = existing.find(b => b.type === t);
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                      type === t
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <meta.icon size={14} className="shrink-0" /> {meta.label}
                    {already && <span className={type === t ? 'opacity-80' : 'text-gray-400'}>•</span>}
                  </button>
                );
              })}
            </div>
            {existingForType && (
              <p className={`text-[11px] mt-1.5 ${sealed ? 'text-amber-600' : 'text-gray-400'}`}>
                {sealed
                  ? "Bu tur uchun yozuv allaqachon muhrlangan — o'zgartirib bo'lmaydi"
                  : 'Bu tur uchun yozuv mavjud — saqlasangiz yangilanadi'}
              </p>
            )}
          </div>

          {sealed ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <Lock size={16} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">Muhrlangan yozuvni o'zgartirib bo'lmaydi. Boshqa tur tanlang.</p>
            </div>
          ) : (
            <>
              {/* Test — ball */}
              {type === 'test' && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ball (0-100)</label>
                  <input
                    type="number" min={0} max={100} value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder="0-100"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Sport — ko'rsatkichlar */}
              {type === 'sport' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Yugurish (sek)</label>
                    <input
                      type="number" min={0} value={runTimeSec}
                      onChange={e => setRunTimeSec(e.target.value)}
                      placeholder="sek"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Sakrash (sm)</label>
                    <input
                      type="number" min={0} value={jumpCm}
                      onChange={e => setJumpCm(e.target.value)}
                      placeholder="sm"
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* Fayl/Audio — og'zaki, ijodiy, maxsus */}
              {showFile && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {type === 'oral' ? 'Audio yozuv' : 'Fayl/Rasm'}
                  </label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 hover:border-emerald-300 rounded-2xl p-4 text-center cursor-pointer transition-colors"
                  >
                    {file ? (
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    ) : (
                      <p className="text-xs text-gray-400">Fayl tanlash uchun bosing</p>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={fileAccept}
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* Ustoz bahosi — og'zaki/ijodiy/maxsus uchun */}
              {(type === 'oral' || type === 'creative' || type === 'custom') && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Ustoz bahosi (0-100)</label>
                  <input
                    type="number" min={0} max={100} value={teacherScore}
                    onChange={e => setTeacherScore(e.target.value)}
                    placeholder="0-100"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Izoh */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Izoh (ixtiyoriy)</label>
                <textarea
                  value={teacherNotes}
                  onChange={e => setTeacherNotes(e.target.value)}
                  rows={2}
                  placeholder="Mezonlar bo'yicha izoh..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
          <button
            onClick={handleSubmit}
            disabled={saveMut.isPending || sealed}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>
  );
}

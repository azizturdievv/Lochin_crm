'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MATERIAL_META } from '@/types/lms';
import type { MaterialType } from '@/types/lms';

interface Props {
  subjectId: string;
  groupId:   string | null;
  onClose:   () => void;
}

const TYPES: MaterialType[] = ['pdf', 'video', 'audio', 'image', 'link'];

export default function UploadMaterialModal({ subjectId, groupId, onClose }: Props) {
  const qc = useQueryClient();

  const [type,     setType]     = useState<MaterialType>('pdf');
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [linkUrl,  setLinkUrl]  = useState('');
  const [lessonDate, setLessonDate] = useState('');
  const [file,     setFile]     = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error,    setError]    = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('subjectId', subjectId);
      if (groupId) form.append('groupId', groupId);
      form.append('type', type);
      form.append('title', title.trim());
      if (desc.trim())      form.append('description', desc.trim());
      if (lessonDate)       form.append('lessonDate', lessonDate);
      if (type === 'link')  form.append('fileUrl', linkUrl.trim());
      if (file)             form.append('file', file);

      return api.post('/lms/materials', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials', subjectId, groupId] });
      qc.invalidateQueries({ queryKey: ['subjects'] });
      onClose();
    },
    onError: () => setError("Yuklashda xatolik yuz berdi"),
  });

  function handleSubmit() {
    setError('');
    if (!title.trim()) { setError("Sarlavha kiritilishi shart"); return; }
    if (type !== 'link' && !file) { setError("Fayl tanlang"); return; }
    if (type === 'link' && !linkUrl.trim()) { setError("Havola URLini kiriting"); return; }
    uploadMut.mutate();
  }

  const accept: Record<MaterialType, string> = {
    pdf:   '.pdf',
    video: 'video/*',
    audio: 'audio/*',
    image: 'image/*',
    link:  '',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">⬆️ Material yuklash</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Tur tanlash */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">Material turi</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map(t => {
                const meta = MATERIAL_META[t];
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors ${
                      type === t
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sarlavha */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sarlavha *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Material nomi"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Dars sanasi */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Dars sanasi (ixtiyoriy)</label>
            <input
              type="date"
              value={lessonDate}
              onChange={e => setLessonDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Havola yoki fayl */}
          {type === 'link' ? (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">URL havola *</label>
              <input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Fayl *</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-emerald-300 rounded-2xl p-4 text-center cursor-pointer transition-colors"
              >
                {file ? (
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <div className="text-3xl mb-1">{MATERIAL_META[type].icon}</div>
                    <p className="text-xs">Fayl tanlash uchun bosing</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={accept[type]}
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {/* Izoh */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Izoh (ixtiyoriy)</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={2}
              placeholder="Qisqacha izoh..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Progress */}
          {uploadMut.isPending && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Yuklanmoqda...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {/* Tugmalar */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Bekor</button>
          <button
            onClick={handleSubmit}
            disabled={uploadMut.isPending}
            className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {uploadMut.isPending ? 'Yuklanmoqda...' : '⬆️ Yuklash'}
          </button>
        </div>
      </div>
    </div>
  );
}

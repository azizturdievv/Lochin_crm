'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MATERIAL_META } from '@/types/lms';
import type { Material, MaterialType } from '@/types/lms';
import UploadMaterialModal from './UploadMaterialModal';

interface Props {
  subjectId: string;
  groupId:   string | null;
  canUpload: boolean;
}

const TYPE_FILTERS: Array<{ value: MaterialType | 'all'; label: string }> = [
  { value: 'all',   label: 'Barchasi' },
  { value: 'pdf',   label: 'PDF' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'link',  label: 'Havola' },
];

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MaterialsTab({ subjectId, groupId, canUpload }: Props) {
  const qc   = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials', subjectId, groupId],
    queryFn:  () => api.get<Material[]>('/lms/materials', {
      params: { subjectId, groupId: groupId ?? undefined },
    }).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/lms/materials/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['materials', subjectId, groupId] }),
  });

  const filtered = typeFilter === 'all'
    ? materials
    : materials.filter(m => m.type === typeFilter);

  async function handleDownload(m: Material) {
    // Yuklab olish sanagini oshirish
    await api.post(`/lms/materials/${m.id}/download`).catch(() => {});
    window.open(m.fileUrl, '_blank');
  }

  return (
    <div className="space-y-4">
      {/* Yuqori panel */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value as MaterialType | 'all')}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                typeFilter === f.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canUpload && (
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            ⬆️ Material yuklash
          </button>
        )}
      </div>

      {/* Ro'yxat */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl">📂</div>
          <p className="text-sm">Materiallar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const meta = MATERIAL_META[m.type];
            return (
              <div
                key={m.id}
                className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-4 py-3 hover:border-emerald-200 hover:shadow-sm transition-all group"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0">
                  {meta.icon}
                </div>

                {/* Ma'lumot */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
                    {m.fileSize && (
                      <span className="text-[10px] text-gray-400">{formatSize(m.fileSize)}</span>
                    )}
                    {m.durationSec && (
                      <span className="text-[10px] text-gray-400">🕐 {formatDuration(m.durationSec)}</span>
                    )}
                    {m.lessonDate && (
                      <span className="text-[10px] text-gray-400">
                        📅 {new Date(m.lessonDate).toLocaleDateString('uz-UZ', { day:'2-digit', month:'short' })}
                      </span>
                    )}
                    {m.uploader && (
                      <span className="text-[10px] text-gray-400">
                        👤 {m.uploader.firstName} {m.uploader.lastName[0]}.
                      </span>
                    )}
                  </div>
                </div>

                {/* Yuklab olishlar */}
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-xs text-gray-400">{m.downloads} ↓</span>
                  <button
                    onClick={() => handleDownload(m)}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    ⬇️ Yuklab olish
                  </button>
                  {canUpload && (
                    <button
                      onClick={() => confirm("O'chirishni tasdiqlaysizmi?") && deleteMut.mutate(m.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {uploadOpen && (
        <UploadMaterialModal
          subjectId={subjectId}
          groupId={groupId}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  );
}

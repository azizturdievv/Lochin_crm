'use client';

import { BarChart3, Lock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BASELINE_TYPE_META, isBaselineSealed } from '@/types/lms';
import type { BaselineAssessment } from '@/types/lms';

interface Props {
  subjectId: string;
  studentId: string | null;
}

export default function BaselineTab({ subjectId, studentId }: Props) {
  const { data: allBaselines = [], isLoading } = useQuery({
    queryKey: ['baselines', studentId],
    queryFn:  () => api.get<BaselineAssessment[]>(`/baseline/student/${studentId}`).then(r => r.data),
    enabled:  !!studentId,
  });
  const baselines = allBaselines.filter(b => b.subjectId === subjectId);

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <div className="text-4xl"><Lock size={36} /></div>
        <p className="text-sm">O'quvchi tanlanmagan</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (baselines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <div className="text-4xl"><BarChart3 size={36} /></div>
        <p className="text-sm">Ilk qabul baholari topilmadi</p>
        <p className="text-xs text-gray-300">Ustoz tomonidan birinchi darsda to'ldiriladi</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Muhrlangan eslatma */}
      {baselines.some(isBaselineSealed) && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <span className="text-xl"><Lock size={16} /></span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Ilk qabul muhrlanagan</p>
            <p className="text-xs text-amber-600">Bu yozuv o'chirilmaydi va o'zgartirilmaydi. Super Admin ham o'zgartira olmaydi.</p>
          </div>
        </div>
      )}

      {baselines.map(b => {
        const meta        = BASELINE_TYPE_META[b.type];
        const displayScore = b.score ?? b.teacherScore;
        const scorePerc    = displayScore != null ? Math.round(displayScore) : null;

        return (
          <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            {/* Sarlavha */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl"><meta.icon size={14} className="shrink-0" /></span>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                  <p className="text-[10px] text-gray-400">
                    {new Date(b.createdAt).toLocaleDateString('uz-UZ', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                    {b.assessedBy && ` · ${b.assessedBy.firstName} ${b.assessedBy.lastName}`}
                  </p>
                </div>
              </div>
              {scorePerc != null && (
                <div className={`text-right ${
                  scorePerc >= 80 ? 'text-green-700' :
                  scorePerc >= 60 ? 'text-amber-700' :
                  'text-red-700'
                }`}>
                  <div className="text-2xl font-bold">{scorePerc}%</div>
                </div>
              )}
            </div>

            {/* Ball progress bar */}
            {scorePerc != null && (
              <div className="mb-4">
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      scorePerc >= 80 ? 'bg-green-500' :
                      scorePerc >= 60 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${scorePerc}%` }}
                  />
                </div>
              </div>
            )}

            {/* Sport natijalari */}
            {b.type === 'sport' && b.sportData && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {b.sportData.runTimeSec != null && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-sm font-bold text-blue-700">
                      {b.sportData.runTimeSec}s
                    </div>
                    <div className="text-[10px] text-blue-500">Yugurish</div>
                  </div>
                )}
                {b.sportData.jumpCm != null && (
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-sm font-bold text-green-700">
                      {b.sportData.jumpCm} sm
                    </div>
                    <div className="text-[10px] text-green-500">Sakrash</div>
                  </div>
                )}
              </div>
            )}

            {/* Audio (og'zaki) */}
            {b.audioUrl && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-1.5">Audio yozuv</p>
                <audio controls src={b.audioUrl} className="w-full h-10" />
              </div>
            )}

            {/* Ijodiy fayl */}
            {b.fileUrl && b.type !== 'oral' && (
              <div className="mb-4">
                <a
                  href={b.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Fayl/Rasm ko'rish
                </a>
              </div>
            )}

            {/* Izoh */}
            {b.teacherNotes && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-gray-600 mb-1">Izoh</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.teacherNotes}</p>
              </div>
            )}

            {/* Muhrlangan belgi */}
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
              {isBaselineSealed(b) ? (
                <span className="text-[10px] text-gray-400">Muhrlangan — o'zgartirib bo'lmaydi</span>
              ) : (
                <span className="text-[10px] text-amber-500">Hali muhrlanmagan</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

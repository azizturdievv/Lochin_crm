'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { BASELINE_TYPE_META } from '@/types/lms';
import type { BaselineAssessment } from '@/types/lms';

interface Props {
  subjectId: string;
  studentId: string | null;
}

export default function BaselineTab({ subjectId, studentId }: Props) {
  const { data: baselines = [], isLoading } = useQuery({
    queryKey: ['baselines', subjectId, studentId],
    queryFn:  () => api.get<BaselineAssessment[]>('/lms/baselines', {
      params: { subjectId, studentId: studentId ?? undefined },
    }).then(r => r.data),
    enabled:  !!studentId,
  });

  if (!studentId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
        <div className="text-4xl">🔒</div>
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
        <div className="text-4xl">📊</div>
        <p className="text-sm">Ilk qabul baholari topilmadi</p>
        <p className="text-xs text-gray-300">Ustoz tomonidan birinchi darsda to'ldiriladi</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Muhrlangan eslatma */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <span className="text-xl">🔒</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Ilk qabul muhrlanagan</p>
          <p className="text-xs text-amber-600">Bu yozuv o'chirilmaydi va o'zgartirilmaydi. Super Admin ham o'zgartira olmaydi.</p>
        </div>
      </div>

      {baselines.map(b => {
        const meta      = BASELINE_TYPE_META[b.type];
        const scorePerc = b.score != null ? Math.round((b.score / b.maxScore) * 100) : null;

        return (
          <div key={b.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            {/* Sarlavha */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{meta.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                  <p className="text-[10px] text-gray-400">
                    {new Date(b.createdAt).toLocaleDateString('uz-UZ', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                    {b.assessor && ` · ${b.assessor.firstName} ${b.assessor.lastName}`}
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
                  <div className="text-[10px]">{b.score}/{b.maxScore}</div>
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
            {b.type === 'sport' && b.metadata && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {(b.metadata as Record<string, unknown>).runTimeSec != null && (
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <div className="text-sm font-bold text-blue-700">
                      {String(b.metadata.runTimeSec)}s
                    </div>
                    <div className="text-[10px] text-blue-500">Yugurish</div>
                  </div>
                )}
                {(b.metadata as Record<string, unknown>).jumpCm != null && (
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <div className="text-sm font-bold text-green-700">
                      {String(b.metadata.jumpCm)} sm
                    </div>
                    <div className="text-[10px] text-green-500">Sakrash</div>
                  </div>
                )}
              </div>
            )}

            {/* Audio (og'zaki) */}
            {b.audioUrl && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-600 mb-1.5">🎤 Audio yozuv</p>
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
                  📎 Fayl/Rasm ko'rish
                </a>
              </div>
            )}

            {/* Izoh */}
            {b.notes && (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-gray-600 mb-1">📝 Izoh</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.notes}</p>
              </div>
            )}

            {/* Muhrlangan belgi */}
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">🔒 Muhrlangan — o'zgartirib bo'lmaydi</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { ERROR_TYPE_META } from '@/types/quality';
import type { SpellingLog, QualityStats } from '@/types/quality';

interface Props {
  userId?:  string;
  showAll?: boolean;
}

export default function SpellingTab({ userId, showAll }: Props) {
  const [page, setPage] = useState(1);

  const { data: stats } = useQuery<QualityStats>({
    queryKey: ['spelling-stats', userId],
    queryFn:  () => api.get('/quality/spelling/stats', {
      params: { userId },
    }).then(r => r.data),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['spelling-logs', userId, page],
    queryFn:  () => api.get<SpellingLog[]>('/quality/spelling/logs', {
      params: { userId, page, limit: 20 },
    }).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      {/* Stats kartalar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.totalMessages}</div>
            <div className="text-xs text-gray-500 mt-0.5">Jami xabarlar</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-4">
            <div className="text-2xl font-bold text-emerald-700">{stats.cleanMessages}</div>
            <div className="text-xs text-emerald-600 mt-0.5">Xatosiz xabarlar</div>
          </div>
          <div className={`rounded-2xl p-4 ${stats.errorMessages > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className={`text-2xl font-bold ${stats.errorMessages > 0 ? 'text-red-700' : 'text-gray-600'}`}>
              {stats.errorMessages}
            </div>
            <div className={`text-xs mt-0.5 ${stats.errorMessages > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              Xatoli xabarlar
            </div>
          </div>
          <div className={`rounded-2xl p-4 ${
            (stats.improvementPercent ?? 0) > 0 ? 'bg-blue-50' :
            (stats.improvementPercent ?? 0) < 0 ? 'bg-amber-50' : 'bg-gray-50'
          }`}>
            <div className={`text-2xl font-bold ${
              (stats.improvementPercent ?? 0) > 0 ? 'text-blue-700' :
              (stats.improvementPercent ?? 0) < 0 ? 'text-amber-700' : 'text-gray-600'
            }`}>
              {stats.improvementPercent != null
                ? `${stats.improvementPercent > 0 ? '+' : ''}${stats.improvementPercent.toFixed(0)}%`
                : '—'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Yaxshilanish</div>
          </div>
        </div>
      )}

      {/* Eng ko'p takrorlanuvchi xatolar */}
      {stats?.topErrors && stats.topErrors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 Tez-tez uchraydigan xatolar</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <span className="text-xs text-red-700 line-through">{e.word}</span>
                <span className="text-gray-300 text-xs">→</span>
                <span className="text-xs text-emerald-700 font-medium">{e.correction}</span>
                <span className="text-[10px] text-gray-400 bg-white rounded-full px-1.5 py-0.5 font-medium">{e.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Xato jurnali */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📜 Xato jurnali</h3>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
            <div className="text-3xl">✅</div>
            <p className="text-sm">Xatolar topilmadi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                {/* Sarlavha */}
                {showAll && log.user && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 overflow-hidden shrink-0">
                      {log.user.avatarUrl
                        ? <img src={log.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : `${log.user.firstName[0]}${log.user.lastName[0]}`}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {log.user.firstName} {log.user.lastName}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(log.createdAt).toLocaleString('uz-UZ', {
                        day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                      })}
                    </span>
                  </div>
                )}

                {/* Matn taqqoslash */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-medium text-red-600 mb-1">❌ Asl matn</p>
                    <p className="text-xs text-gray-700 bg-red-50 rounded-xl p-2 leading-relaxed">
                      {log.originalText}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-emerald-600 mb-1">✅ To'g'rilangan</p>
                    <p className="text-xs text-gray-700 bg-emerald-50 rounded-xl p-2 leading-relaxed">
                      {log.correctedText}
                    </p>
                  </div>
                </div>

                {/* Tuzatishlar */}
                {log.corrections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {log.corrections.map((c, ci) => (
                      <div key={ci} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                        c.errorType === 'spelling' ? 'bg-red-50 border-red-200' :
                        c.errorType === 'grammar'  ? 'bg-amber-50 border-amber-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <span className={`line-through ${ERROR_TYPE_META[c.errorType].color}`}>{c.word}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-700">{c.correction}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!showAll && (
                  <p className="text-[10px] text-gray-400 mt-2">
                    {new Date(log.createdAt).toLocaleString('uz-UZ', {
                      day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit',
                    })}
                  </p>
                )}
              </div>
            ))}

            {/* Ko'proq yuklash */}
            {logs.length === 20 && (
              <button
                onClick={() => setPage(p => p + 1)}
                className="w-full text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 py-2.5 rounded-xl transition-colors font-medium"
              >
                Ko'proq yuklash
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

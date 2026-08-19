'use client';

import { X, AlertTriangle, BarChart3, Archive, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { scoreToLevel } from '@/types/lms';
import type { TestResultsResponse } from '@/types/lms';
import TestResultDetailModal from './TestResultDetailModal';

interface Props {
  testId:  string;
  onClose: () => void;
}

function formatTime(sec: number | null): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}d ${s}s`;
}

export default function TestResultsModal({ testId, onClose }: Props) {
  const [detailResultId, setDetailResultId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['test-results', testId],
    queryFn:  () => api.get<TestResultsResponse>(`/tests/${testId}/results`).then(r => r.data),
  });

  const test    = data?.test;
  const stats   = data?.stats;
  const results = data?.results ?? [];

  if (detailResultId) {
    return (
      <TestResultDetailModal
        resultId={detailResultId}
        onClose={() => setDetailResultId(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">{test?.title ?? 'Test natijalari'}</h2>
            {stats && (
              <p className="text-xs text-gray-400 mt-0.5">
                {stats.total} o'quvchi · o'rtacha {stats.avgScore}%
                {stats.cheatingFlags > 0 && (
                  <span className="text-amber-600"> · {stats.cheatingFlags} shubhali urinish</span>
                )}
              </p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors shrink-0"><X size={16} /></button>
        </div>

        {/* Daraja taqsimoti */}
        {stats && stats.total > 0 && (
          <div className="flex gap-2 px-6 pt-4 shrink-0">
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-red-50 text-red-600">Oson: {stats.levelDistribution.easy}</span>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-600">O'rta: {stats.levelDistribution.medium}</span>
            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">Qiyin: {stats.levelDistribution.hard}</span>
          </div>
        )}

        {/* Ro'yxat */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
              <BarChart3 size={28} />
              <p className="text-sm">Hali hech kim test topshirmagan</p>
            </div>
          ) : (
            results.map(r => {
              const level = scoreToLevel(r.score);
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 border rounded-2xl px-4 py-2.5 ${
                    r.cheatingFlag ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {r.student ? `${r.student.firstName} ${r.student.lastName}` : "O'quvchi topilmadi"}
                      </span>
                      <span className="text-[10px] text-gray-400">{r.attemptNumber}-urinish</span>
                      {r.studentArchived && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          <Archive size={10} /> Arxivlangan
                        </span>
                      )}
                      {r.cheatingFlag && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <AlertTriangle size={10} /> Shubhali
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {r.earnedPoints}/{r.totalPoints} ball · {formatTime(r.timeSpentSeconds)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailResultId(r.id)}
                    className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-xl transition-colors"
                  >
                    <ListChecks size={13} /> Batafsil
                  </button>
                  <div className={`text-lg font-bold shrink-0 ${level.color}`}>
                    {r.score.toFixed(0)}%
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

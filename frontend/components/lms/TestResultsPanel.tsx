'use client';

import { AlertTriangle, BarChart3, Archive, ListChecks, MonitorX, Lock, Unlock, PieChart, RotateCcw, Check } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { scoreToLevel, DIFFICULTY_META } from '@/types/lms';
import type { TestResultsResponse, QuestionAnalysisResponse } from '@/types/lms';
import TestResultDetailModal from './TestResultDetailModal';
import { useTestProctorSocket } from '@/hooks/useTestProctorSocket';

function wrongRateColor(rate: number): string {
  if (rate >= 50) return 'text-red-600 bg-red-50';
  if (rate >= 25) return 'text-amber-600 bg-amber-50';
  return 'text-emerald-600 bg-emerald-50';
}

interface Props {
  testId: string;
}

function formatTime(sec: number | null): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}d ${s}s`;
}

// TestResultsModal'dan chiqarilgan — endi TestDetailModal ichida "Natijalar"
// tabi sifatida ko'rsatiladi, o'z backdrop/qobig'iga ega emas
export default function TestResultsPanel({ testId }: Props) {
  const qc = useQueryClient();
  const [detailResultId, setDetailResultId] = useState<string | null>(null);
  const [view, setView] = useState<'students' | 'analysis'>('students');

  const { data, isLoading } = useQuery({
    queryKey: ['test-results', testId],
    queryFn:  () => api.get<TestResultsResponse>(`/tests/${testId}/results`).then(r => r.data),
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['test-question-analysis', testId],
    queryFn:  () => api.get<QuestionAnalysisResponse>(`/tests/${testId}/question-analysis`).then(r => r.data),
    enabled:  view === 'analysis',
  });

  const { alerts } = useTestProctorSocket(testId);
  const liveResultIds = new Set(alerts.filter(a => Date.now() - a.at < 15000).map(a => a.resultId));

  const releaseMut = useMutation({
    mutationFn: () => api.patch(`/tests/${testId}/release-results`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['test-results', testId] }),
  });

  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const grantAttemptMut = useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/tests/${testId}/students/${studentId}/grant-attempt`, {}),
    onSuccess: (_data, studentId) => {
      setGrantedIds(prev => new Set(prev).add(studentId));
    },
  });

  const test    = data?.test;
  const stats   = data?.stats;
  const results = data?.results ?? [];
  const isGated = test && !test.resultsAutoVisible && !test.resultsReleasedAt;

  if (detailResultId) {
    return (
      <TestResultDetailModal
        resultId={detailResultId}
        onClose={() => setDetailResultId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {stats && (
        <div className="flex items-center justify-between px-1 pb-3 shrink-0">
          <p className="text-xs text-gray-400">
            {stats.total} o'quvchi · o'rtacha {stats.avgScore}%
            {stats.cheatingFlags > 0 && (
              <span className="text-amber-600"> · {stats.cheatingFlags} shubhali urinish</span>
            )}
          </p>
          {isGated && (
            <button
              onClick={() => releaseMut.mutate()}
              disabled={releaseMut.isPending}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            >
              <Unlock size={13} /> Natijalarni ochish
            </button>
          )}
        </div>
      )}

      {/* Nazorat ishi holati */}
      {test && !test.resultsAutoVisible && (
        <div className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shrink-0 mb-3 ${
          test.resultsReleasedAt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {test.resultsReleasedAt ? <Unlock size={13} /> : <Lock size={13} />}
          {test.resultsReleasedAt
            ? "Nazorat ishi — natijalar o'quvchilarga ochilgan"
            : "Nazorat ishi — natijalar o'quvchilarga hali yopiq"}
        </div>
      )}

      {/* Jonli signal: hozirgina chiqib ketgan */}
      {alerts.length > 0 && Date.now() - alerts[0].at < 15000 && (
        <div className="px-3 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-700 flex items-center gap-2 shrink-0 animate-pulse mb-3">
          <MonitorX size={13} />
          {alerts[0].studentName} hozir boshqa tab/oynaga chiqdi ({alerts[0].tabSwitchCount}-marta)
        </div>
      )}

      {/* Ko'rinish tanlovi */}
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => setView('students')}
          className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
            view === 'students'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          O&apos;quvchilar
        </button>
        <button
          onClick={() => setView('analysis')}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
            view === 'analysis'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          <PieChart size={13} /> Savollar tahlili
        </button>
      </div>

      {/* Daraja taqsimoti */}
      {view === 'students' && stats && stats.total > 0 && (
        <div className="flex gap-2 pt-4 shrink-0">
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-red-50 text-red-600">Oson: {stats.levelDistribution.easy}</span>
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-600">O'rta: {stats.levelDistribution.medium}</span>
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">Qiyin: {stats.levelDistribution.hard}</span>
        </div>
      )}

      {/* Savollar/mavzu tahlili */}
      {view === 'analysis' && (
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {analysisLoading ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />)
          ) : !analysis || analysis.questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
              <PieChart size={28} />
              <p className="text-sm">Tahlil uchun yetarli ma&apos;lumot yo&apos;q</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] text-gray-400">{analysis.studentsCounted} o&apos;quvchining tugallangan urinishi bo&apos;yicha</p>

              {analysis.topics.length > 1 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-2">Mavzu bo&apos;yicha</h3>
                  <div className="space-y-1.5">
                    {analysis.topics.map(t => (
                      <div key={t.topic} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-800 truncate">{t.topic}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-gray-400">{t.wrong}/{t.shown} xato</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${wrongRateColor(t.wrongRate)}`}>
                            {t.wrongRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-gray-700 mb-2">Savol bo&apos;yicha (eng ko&apos;p xato — yuqorida)</h3>
                <div className="space-y-1.5">
                  {analysis.questions.map((q, i) => (
                    <div key={q.id} className="px-3 py-2 rounded-xl border border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-800 min-w-0">{i + 1}. {q.question}</p>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${wrongRateColor(q.wrongRate)}`}>
                          {q.wrongRate}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {q.topic && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{q.topic}</span>
                        )}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_META[q.difficulty].bg} ${DIFFICULTY_META[q.difficulty].color}`}>
                          {DIFFICULTY_META[q.difficulty].label}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {q.correct} to&apos;g&apos;ri · {q.wrong} xato{q.unanswered > 0 && ` · ${q.unanswered} javobsiz`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ro'yxat */}
      {view === 'students' && (
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
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
                  liveResultIds.has(r.id) ? 'border-red-300 bg-red-50/50' :
                  r.cheatingFlag || r.tabSwitchCount > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'
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
                    {r.tabSwitchCount > 0 && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        liveResultIds.has(r.id) ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <MonitorX size={10} /> {r.tabSwitchCount} marta chiqdi
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
                {grantedIds.has(r.studentId) ? (
                  <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl">
                    <Check size={13} /> Berildi
                  </span>
                ) : (
                  <button
                    onClick={() => grantAttemptMut.mutate(r.studentId)}
                    disabled={grantAttemptMut.isPending}
                    title="Qo'shimcha urinish berish"
                    className="shrink-0 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={13} /> Qayta urinish
                  </button>
                )}
                <div className={`text-lg font-bold shrink-0 ${level.color}`}>
                  {r.score.toFixed(0)}%
                </div>
              </div>
            );
          })
        )}
      </div>
      )}
    </div>
  );
}

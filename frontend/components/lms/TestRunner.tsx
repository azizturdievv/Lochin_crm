'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Test, TestQuestion, SubmitTestPayload, TestResult } from '@/types/lms';
import TestResultModal from './TestResultModal';

interface Props {
  test:    Test;
  onClose: () => void;
}

export default function TestRunner({ test, onClose }: Props) {
  const [answers,      setAnswers]      = useState<Record<string, number>>({});
  const [timeLeft,     setTimeLeft]     = useState(test.durationMinutes * 60);
  const [tabSwitches,  setTabSwitches]  = useState(0);
  const [result,       setResult]       = useState<TestResult | null>(null);
  const [extReq,       setExtReq]       = useState(false);
  const [extSent,      setExtSent]      = useState(false);
  const startRef  = useRef(Date.now());
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Savollarni yuklash
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['test-questions', test.id],
    queryFn:  () => api.get<TestQuestion[]>(`/lms/tests/${test.id}/questions`).then(r => r.data),
  });

  // Anti-cheat: tab almashtirish
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) setTabSwitches(n => n + 1);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [questions]);

  const submitMut = useMutation({
    mutationFn: (payload: SubmitTestPayload) =>
      api.post<TestResult>(`/lms/tests/${test.id}/submit`, payload).then(r => r.data),
    onSuccess: data => setResult(data),
  });

  const extMut = useMutation({
    mutationFn: () => api.post(`/lms/tests/${test.id}/extend-request`),
    onSuccess:  () => setExtSent(true),
  });

  const handleSubmit = useCallback((autoSubmit = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const timeSpentSec = Math.floor((Date.now() - startRef.current) / 1000);
    submitMut.mutate({
      testId:       test.id,
      answers,
      timeSpentSec,
      tabSwitches,
    });
  }, [answers, tabSwitches]);

  if (result) {
    return (
      <TestResultModal
        test={test}
        result={result}
        questions={questions}
        answers={answers}
        onClose={onClose}
      />
    );
  }

  const answered   = Object.keys(answers).length;
  const total      = questions.length;
  const progress   = total > 0 ? (answered / total) * 100 : 0;
  const urgent     = timeLeft <= 60;
  const mins       = Math.floor(timeLeft / 60);
  const secs       = timeLeft % 60;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha + Timer ───────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
        urgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => { if (confirm("Testni tark etasizmi? Natija saqlanmaydi.")) onClose(); }}
            className="text-gray-400 hover:text-gray-600 text-sm w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm truncate">{test.title}</h2>
            <p className="text-xs text-gray-400">{answered}/{total} javob berildi</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Anti-cheat ko'rsatgich */}
          {tabSwitches > 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-xl">
              ⚠️ {tabSwitches} tab
            </span>
          )}

          {/* Timer */}
          <div className={`font-mono text-lg font-bold tabular-nums px-3 py-1 rounded-xl ${
            urgent ? 'text-red-600 bg-red-100 animate-pulse' : 'text-gray-900 bg-gray-100'
          }`}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>

          {/* Vaqt uzaytirish */}
          {!extSent && timeLeft <= 120 && (
            <button
              onClick={() => { setExtReq(true); extMut.mutate(); }}
              disabled={extReq}
              className="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors font-medium disabled:opacity-50"
            >
              {extSent ? '✓ So\'rov yuborildi' : '⏳ Vaqt so\'rash'}
            </button>
          )}
          {extSent && (
            <span className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl">
              ✓ Ustoz ko'rmoqda
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 shrink-0">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ─── Savollar ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-10 bg-gray-100 rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {questions.map((q, qi) => (
              <div key={q.id} className="space-y-3">
                {/* Savol */}
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center">
                    {qi + 1}
                  </span>
                  <p className="text-sm font-medium text-gray-900 leading-relaxed pt-1">{q.text}</p>
                </div>

                {/* Variantlar */}
                <div className="space-y-2 ml-10">
                  {q.options.map((opt, oi) => {
                    const selected = answers[q.id] === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all border ${
                          selected
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                        }`}>
                          {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Pastki panel ───────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-gray-400">
            {total - answered > 0
              ? `${total - answered} ta savol javobsiz`
              : '✅ Barcha savollarga javob berildi'}
          </div>
          <button
            onClick={() => {
              const unanswered = total - answered;
              if (unanswered > 0) {
                if (!confirm(`${unanswered} ta savol javobsiz. Baribir topshirasizmi?`)) return;
              }
              handleSubmit();
            }}
            disabled={submitMut.isPending || total === 0}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {submitMut.isPending ? 'Topshirilmoqda...' : '✓ Testni topshirish'}
          </button>
        </div>
      </div>
    </div>
  );
}

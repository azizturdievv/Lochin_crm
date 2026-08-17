'use client';

import { Heart, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  Test, TestStartResponse, TestSubmitResponse, CheckAnswerResponse, MyExtensionStatus,
} from '@/types/lms';
import TestResultModal from './TestResultModal';

interface Props {
  test:    Test;
  onClose: () => void;
}

const MAX_HEARTS = 3;
const FEEDBACK_DELAY_MS = 1200;

export default function TestRunner({ test, onClose }: Props) {
  const [phase,       setPhase]       = useState<'start' | 'playing' | 'finished'>('start');
  const [session,     setSession]     = useState<TestStartResponse | null>(null);
  const [index,       setIndex]       = useState(0);
  const [hearts,      setHearts]      = useState(MAX_HEARTS);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [feedback,    setFeedback]    = useState<CheckAnswerResponse | null>(null);
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [extReq,      setExtReq]      = useState(false);
  const [extSent,     setExtSent]     = useState(false);
  const [extResolved, setExtResolved] = useState<'approved' | 'rejected' | null>(null);
  const extraAppliedRef = useRef(false);
  const [submitError, setSubmitError] = useState('');
  const [result,      setResult]      = useState<TestSubmitResponse | null>(null);

  const questionTimesRef = useRef<Record<string, number>>({});
  // `answers` state faqat qayta render uchun; submit har doim shu ref'dan
  // o'qiydi — aks holda so'nggi javob "eskirgan closure" tufayli tushib qolardi
  const answersRef = useRef<Record<string, string>>({});
  const qStartRef  = useRef(Date.now());
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const startMut = useMutation({
    mutationFn: () => api.post<TestStartResponse>(`/tests/${test.id}/start`).then(r => r.data),
    onSuccess: (data) => {
      setSession(data);
      setTimeLeft(data.timeLimitMinutes * 60);
      setPhase('playing');
      qStartRef.current = Date.now();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setSubmitError(e.response?.data?.message ?? "Testni boshlashda xatolik"),
  });

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkMut = useMutation({
    mutationFn: (opts: { questionId: string; answer: string }) =>
      api.post<CheckAnswerResponse>('/tests/check-answer', {
        testResultId: session!.testResultId,
        questionId:   opts.questionId,
        answer:       opts.answer,
      }).then(r => r.data),
  });

  const submitMut = useMutation({
    mutationFn: () =>
      api.post<TestSubmitResponse>('/tests/submit', {
        testResultId:  session!.testResultId,
        answers:       answersRef.current,
        questionTimes: questionTimesRef.current,
      }).then(r => r.data),
    onSuccess: (data) => { setResult(data); setPhase('finished'); },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setSubmitError(e.response?.data?.message ?? 'Topshirishda xatolik yuz berdi'),
  });

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    submitMut.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Umumiy test vaqti
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { finish(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  function handleSelect(optionId: string) {
    if (!session || selected !== null || checkMut.isPending) return;
    const q = session.questions[index];

    const elapsed = Math.round((Date.now() - qStartRef.current) / 1000);
    questionTimesRef.current = { ...questionTimesRef.current, [q.id]: elapsed };
    answersRef.current = { ...answersRef.current, [q.id]: optionId };
    setSelected(optionId);

    checkMut.mutate({ questionId: q.id, answer: optionId }, {
      onSuccess: (data) => {
        setFeedback(data);
        if (!data.correct) setHearts(h => Math.max(0, h - 1));

        advanceRef.current = setTimeout(() => {
          const outOfHearts = !data.correct && hearts - 1 <= 0;
          const isLast = index + 1 >= session.questions.length;
          if (outOfHearts || isLast) {
            finish();
          } else {
            setIndex(i => i + 1);
            setSelected(null);
            setFeedback(null);
            qStartRef.current = Date.now();
          }
        }, FEEDBACK_DELAY_MS);
      },
    });
  }

  const extMut = useMutation({
    mutationFn: () => api.post('/tests/time-extension/request', {
      testId: test.id,
      testResultId: session!.testResultId,
      extraMinutes: 10,
    }),
    onSuccess: () => setExtSent(true),
  });

  // Tasdiqlanguncha/rad etilguncha holatni so'rab turish
  const { data: extStatus } = useQuery({
    queryKey: ['ext-status', session?.testResultId],
    queryFn:  () => api.get<MyExtensionStatus>(`/tests/time-extension/my-status/${session!.testResultId}`).then(r => r.data),
    enabled:  extSent && !extResolved && !!session,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (!extStatus || extraAppliedRef.current) return;
    if (extStatus.status === 'approved') {
      extraAppliedRef.current = true;
      setTimeLeft(t => t + (extStatus.extraMinutes ?? 0) * 60);
      setExtResolved('approved');
    } else if (extStatus.status === 'rejected') {
      setExtResolved('rejected');
    }
  }, [extStatus]);

  if (phase === 'finished' && result && session) {
    return (
      <TestResultModal
        test={test}
        result={result}
        questions={session.questions}
        outOfHearts={hearts <= 0}
        onClose={onClose}
      />
    );
  }

  if (phase === 'start' || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        {submitError ? (
          <>
            <p className="text-sm text-red-600">{submitError}</p>
            <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 rounded-xl hover:bg-gray-200">Yopish</button>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Test tayyorlanmoqda...</p>
          </>
        )}
      </div>
    );
  }

  const q         = session.questions[index];
  const total     = session.questions.length;
  const progress  = (index / total) * 100;
  const urgent    = timeLeft <= 60;
  const mins      = Math.floor(timeLeft / 60);
  const secs      = timeLeft % 60;

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha: yopish, jonlar, timer ───────────────────────────── */}
      <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${
        urgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
      }`}>
        <button
          onClick={() => { if (confirm("Testni tark etasizmi? Natija saqlanmaydi.")) onClose(); }}
          className="text-gray-400 hover:text-gray-600 text-sm w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors"
        ><X size={16} /></button>

        {/* Jonlar */}
        <div className="flex items-center gap-1">
          {Array.from({ length: MAX_HEARTS }).map((_, i) => (
            <Heart
              key={i}
              size={20}
              className={i < hearts ? 'text-red-500 fill-red-500' : 'text-gray-200 fill-gray-200'}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className={`font-mono text-lg font-bold tabular-nums px-3 py-1 rounded-xl ${
            urgent ? 'text-red-600 bg-red-100 animate-pulse' : 'text-gray-900 bg-gray-100'
          }`}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          {!extSent && timeLeft <= 120 && (
            <button
              onClick={() => { setExtReq(true); extMut.mutate(); }}
              disabled={extReq}
              className="text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors font-medium disabled:opacity-50"
            >
              Vaqt so'rash
            </button>
          )}
          {extSent && !extResolved && (
            <span className="text-xs text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl">Ustoz ko'rmoqda...</span>
          )}
          {extResolved === 'approved' && (
            <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl font-medium">
              ✅ +{extStatus?.extraMinutes} daqiqa qo'shildi
            </span>
          )}
          {extResolved === 'rejected' && (
            <span className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-xl">Rad etildi</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 shrink-0">
        <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* ─── Savol ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
        <div className="w-full max-w-lg">
          <p className="text-xs text-gray-400 text-center mb-2">{index + 1} / {total}</p>
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-8 leading-relaxed">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map((opt) => {
              const isSelected = selected === opt.id;
              const isCorrectOpt = feedback && opt.id === feedback.correctAnswer;
              const showState = feedback !== null;

              let cls = 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50';
              if (showState && isCorrectOpt) cls = 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium';
              else if (showState && isSelected && !feedback!.correct) cls = 'bg-red-50 border-red-400 text-red-800 font-medium animate-[shake_0.3s]';
              else if (isSelected) cls = 'bg-primary-50 border-primary-400 text-primary-800 font-medium';

              return (
                <button
                  key={opt.id}
                  onClick={() => handleSelect(opt.id)}
                  disabled={selected !== null}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left text-sm transition-all border-2 disabled:cursor-default ${cls}`}
                >
                  <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    showState && isCorrectOpt ? 'border-emerald-500 bg-emerald-500 text-white'
                    : showState && isSelected && !feedback!.correct ? 'border-red-500 bg-red-500 text-white'
                    : isSelected ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-gray-300 text-transparent'
                  }`}>
                    {showState && isCorrectOpt ? '✓' : showState && isSelected && !feedback!.correct ? '✕' : ''}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>

          {/* Darhol feedback banner */}
          {feedback && (
            <div className={`mt-6 text-center py-3 rounded-2xl text-sm font-semibold ${
              feedback.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {feedback.correct ? "To'g'ri! 🎉" : "Xato — to'g'ri javob yuqorida ko'rsatildi"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

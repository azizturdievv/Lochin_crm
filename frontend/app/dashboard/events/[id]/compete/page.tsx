'use client';

import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CrmEvent, CompetitionStartResponse, CompetitionSubmitResponse } from '@/types/events';

export default function CompetePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc     = useQueryClient();

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', params.id],
    queryFn:  () => api.get<CrmEvent>(`/events/${params.id}`).then(r => r.data),
  });

  const [session,  setSession]  = useState<CompetitionStartResponse | null>(null);
  const [index,    setIndex]    = useState(0);
  const [answers,  setAnswers]  = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [result,   setResult]   = useState<CompetitionSubmitResponse | null>(null);
  const [error,    setError]    = useState('');

  // Refs — submit har doim eng so'nggi javoblarni o'qishi kerak, "eskirgan
  // closure" muammosi bo'lmasligi uchun (LMS TestRunner'dagi bilan bir xil naqsh)
  const answersRef  = useRef<Record<string, string>>({});
  const startTimeRef = useRef(0);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const participantId = event?.myParticipation?.id;

  const startMut = useMutation({
    mutationFn: () =>
      api.get<CompetitionStartResponse>(`/events/${params.id}/competition/questions/${participantId}`).then(r => r.data),
    onSuccess: (data) => {
      setSession(data);
      setTimeLeft(data.timeLimit * 60);
      startTimeRef.current = Date.now();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const submitMut = useMutation({
    mutationFn: () => {
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
      return api.post<CompetitionSubmitResponse>(
        `/events/${params.id}/competition/submit/${participantId}`,
        {
          answers: Object.entries(answersRef.current).map(([questionId, answer]) => ({ questionId, answer })),
          timeTaken,
        },
      ).then(r => r.data);
    },
    onSuccess: (data) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setResult(data);
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['event', params.id] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Yuborishda xatolik'),
  });

  function selectAnswer(questionId: string, optionId: string) {
    answersRef.current = { ...answersRef.current, [questionId]: optionId };
    setAnswers(answersRef.current);
  }

  // Umumiy taymer — 0ga tushganda avtomatik yuboriladi
  useEffect(() => {
    if (!session || result) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          submitMut.mutate();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, result]);

  // Sahifadan tasodifan chiqishdan ogohlantirish
  useEffect(() => {
    if (!session || result) return;
    function handler(e: BeforeUnloadEvent) { e.preventDefault(); }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [session, result]);

  if (isLoading) {
    return <div className="p-6 max-w-lg mx-auto"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  }

  if (!event) {
    return <GuardScreen title="Topilmadi" message="Tadbir topilmadi." onBack={() => router.push('/dashboard/events')} />;
  }

  const alreadyDone = event.myParticipation?.score !== null && event.myParticipation?.score !== undefined;

  if (!event.myParticipation) {
    return <GuardScreen title="Ro'yxatdan o'tilmagan" message="Bu musobaqaga ro'yxatdan o'tmagansiz." onBack={() => router.push('/dashboard/events')} />;
  }

  if (alreadyDone && !result) {
    return (
      <ResultScreen
        title={event.title}
        score={Number(event.myParticipation.score)}
        place={event.myParticipation.place}
        onBack={() => router.push('/dashboard/events')}
      />
    );
  }

  if (result) {
    return (
      <ResultScreen
        title={event.title}
        score={result.score}
        totalPoints={result.totalPoints}
        correctCount={result.correctCount}
        total={session?.questions.length}
        onBack={() => router.push('/dashboard/events')}
      />
    );
  }

  if (event.myParticipation.paymentStatus === 'pending') {
    return <GuardScreen title="To'lov kutilmoqda" message="Testni boshlash uchun avval to'lov tasdiqlanishi kerak." onBack={() => router.push('/dashboard/events')} />;
  }

  if (event.competitionStatus === 'not_started') {
    return <GuardScreen title="Hali boshlanmagan" message="Musobaqa hali boshlanmagan. Ustoz/admin boshlashini kuting." onBack={() => router.push('/dashboard/events')} />;
  }

  if (event.competitionStatus === 'finished') {
    return <GuardScreen title="Musobaqa yakunlandi" message="Bu musobaqa allaqachon yakunlangan." onBack={() => router.push('/dashboard/events')} />;
  }

  // ── Boshlash ekrani ──────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
        <h1 className="text-lg font-bold text-gray-900">{event.title}</h1>
        <div className="bg-gray-50 rounded-2xl p-5 space-y-1.5 text-sm text-gray-600">
          <p>{event.questionCount} ta savol</p>
          <p>{event.timeLimit} daqiqa vaqt</p>
          <p className="text-amber-600 text-xs mt-2">
            Boshlagandan keyin sahifani qayta yuklamang — vaqt va savollar qayta belgilanmaydi.
          </p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={() => startMut.mutate()}
          disabled={startMut.isPending}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
        >
          {startMut.isPending ? 'Yuklanmoqda...' : 'Boshlash'}
        </button>
        <button onClick={() => router.push('/dashboard/events')} className="text-sm text-gray-400 hover:text-gray-600">
          <ChevronLeft size={14} className="inline" /> Orqaga
        </button>
      </div>
    );
  }

  // ── Test yechish ekrani ──────────────────────────────────────────────────
  const q             = session.questions[index];
  const answeredCount = Object.keys(answers).length;
  const mins           = Math.floor(timeLeft / 60);
  const secs           = timeLeft % 60;
  const urgent          = timeLeft <= 60;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${urgent ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
        <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
        <div className={`font-mono text-base font-bold tabular-nums px-3 py-1 rounded-xl ${
          urgent ? 'text-red-600 bg-red-100 animate-pulse' : 'text-gray-900 bg-gray-100'
        }`}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      {/* Savol raqamlagichi */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-gray-100 shrink-0">
        {session.questions.map((sq, i) => (
          <button
            key={sq.id}
            onClick={() => setIndex(i)}
            className={`shrink-0 w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
              i === index ? 'bg-primary-600 text-white'
              : answers[sq.id] ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center">
        <div className="w-full max-w-lg">
          <p className="text-xs text-gray-400 text-center mb-2">{index + 1} / {session.questions.length}</p>
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-8 leading-relaxed">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map(opt => {
              const isSelected = answers[q.id] === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => selectAnswer(q.id, opt.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left text-sm transition-all border-2 ${
                    isSelected
                      ? 'bg-primary-50 border-primary-400 text-primary-800 font-medium'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    isSelected ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300 text-transparent'
                  }`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0 gap-3">
        <button
          onClick={() => setIndex(i => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl disabled:opacity-40 transition-colors"
        >
          Oldingi
        </button>
        <p className="text-xs text-gray-400 hidden sm:block">{answeredCount}/{session.questions.length} javob berilgan</p>
        {index + 1 < session.questions.length ? (
          <button
            onClick={() => setIndex(i => i + 1)}
            className="px-4 py-2 text-sm text-white bg-gray-700 hover:bg-gray-800 rounded-xl transition-colors"
          >
            Keyingi
          </button>
        ) : (
          <button
            onClick={() => {
              const unanswered = session.questions.length - answeredCount;
              if (unanswered > 0 && !confirm(`${unanswered} ta savolga javob berilmagan. Baribir yuborilsinmi?`)) return;
              submitMut.mutate();
            }}
            disabled={submitMut.isPending}
            className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {submitMut.isPending ? 'Yuborilmoqda...' : 'Yakunlash'}
          </button>
        )}
      </div>
    </div>
  );
}

function GuardScreen({ title, message, onBack }: { title: string; message: string; onBack: () => void }) {
  return (
    <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
      <AlertTriangle size={32} className="mx-auto text-amber-500" />
      <h1 className="text-base font-bold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500">{message}</p>
      <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
        <ChevronLeft size={14} className="inline" /> Tadbirlarga qaytish
      </button>
    </div>
  );
}

function ResultScreen({ title, score, totalPoints, correctCount, total, place, onBack }: {
  title: string; score: number; totalPoints?: number; correctCount?: number; total?: number; place?: number | null; onBack: () => void;
}) {
  return (
    <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
      <h1 className="text-base font-bold text-gray-900">{title}</h1>
      <div className="bg-emerald-50 rounded-2xl p-6">
        <p className="text-xs text-emerald-600 mb-1">Natijangiz</p>
        <p className="text-3xl font-bold text-emerald-800">
          {score}{totalPoints !== undefined ? ` / ${totalPoints}` : ''}
        </p>
        {correctCount !== undefined && total !== undefined && (
          <p className="text-xs text-emerald-600 mt-1">{correctCount} / {total} to'g'ri javob</p>
        )}
        {!!place && <p className="text-sm text-emerald-700 mt-2 font-medium">{place}-o'rin</p>}
      </div>
      <button onClick={onBack} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
        <ChevronLeft size={14} className="inline" /> Tadbirlarga qaytish
      </button>
    </div>
  );
}

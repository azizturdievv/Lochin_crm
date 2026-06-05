'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { MASTERY_META } from '@/types/gamification';
import type { VocabWord, MasteryLevel, VocabTestQuestion } from '@/types/gamification';

interface Props {
  canAdd: boolean;
}

type ViewMode = 'list' | 'test';

export default function VocabTab({ canAdd }: Props) {
  const qc      = useQueryClient();
  const [mode,  setMode]  = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const { data: words = [], isLoading } = useQuery({
    queryKey: ['vocab-words'],
    queryFn:  () => api.get<VocabWord[]>('/gamification/vocab').then(r => r.data),
  });

  const filtered = search
    ? words.filter(w =>
        w.word.toLowerCase().includes(search.toLowerCase()) ||
        w.translation.toLowerCase().includes(search.toLowerCase())
      )
    : words;

  const stats = {
    total:    words.length,
    mastered: words.filter(w => w.masteryLevel === 3).length,
    learning: words.filter(w => w.masteryLevel > 0 && w.masteryLevel < 3).length,
    newWords: words.filter(w => w.masteryLevel === 0).length,
  };

  if (mode === 'test') {
    return <VocabTest words={words} onBack={() => setMode('list')} />;
  }

  return (
    <div className="space-y-4">
      {/* KPI + test */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 grid grid-cols-4 gap-2">
          {[
            { label: 'Jami', value: stats.total, color: 'blue' },
            { label: 'Yangi', value: stats.newWords, color: 'gray' },
            { label: "O'rganilmoqda", value: stats.learning, color: 'amber' },
            { label: 'Mustahkam', value: stats.mastered, color: 'emerald' },
          ].map(s => (
            <div key={s.label} className={`bg-${s.color}-50 rounded-2xl p-3 text-center`}>
              <div className={`text-lg font-bold text-${s.color}-700`}>{s.value}</div>
              <div className={`text-[10px] text-${s.color}-600`}>{s.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setMode('test')}
          disabled={words.length < 4}
          className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 shrink-0"
        >
          📝 Haftalik test
        </button>
      </div>

      {/* Qidiruv + qo'shish */}
      <div className="flex gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="So'z qidirish..."
          className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {canAdd && (
          <button
            onClick={() => setAddOpen(true)}
            className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shrink-0"
          >
            + So'z
          </button>
        )}
      </div>

      {/* So'zlar ro'yxati */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
          <div className="text-3xl">📚</div>
          <p className="text-sm">{search ? 'So\'z topilmadi' : 'Lug\'at bo\'sh'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(word => {
            const meta = MASTERY_META[word.masteryLevel as MasteryLevel];
            return (
              <div
                key={word.id}
                className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-4 py-3 hover:border-gray-200 transition-colors"
              >
                {/* Daraja */}
                <div className={`shrink-0 w-2 h-2 rounded-full ${
                  word.masteryLevel === 0 ? 'bg-gray-300' :
                  word.masteryLevel === 1 ? 'bg-blue-400' :
                  word.masteryLevel === 2 ? 'bg-amber-400' :
                  'bg-emerald-500'
                }`} />

                {/* So'z */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{word.word}</span>
                    <span className="text-gray-300 text-xs">—</span>
                    <span className="text-sm text-gray-600 truncate">{word.translation}</span>
                  </div>
                  {word.exampleSentence && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5 italic">{word.exampleSentence}</p>
                  )}
                </div>

                {/* Meta */}
                <div className="shrink-0 flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  {word.testCount > 0 && (
                    <span className="text-[10px] text-gray-400">{word.testCount}× test</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addOpen && <AddWordModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── Haftalik test ────────────────────────────────────────────────────────────
function VocabTest({ words, onBack }: { words: VocabWord[]; onBack: () => void }) {
  const qc = useQueryClient();

  // 10 ta random so'z, har biri uchun 4 ta variant
  const [questions] = useState<VocabTestQuestion[]>(() => {
    const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, 10);
    return shuffled.map(w => {
      const others = words.filter(x => x.id !== w.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(x => x.translation);
      const opts = [...others, w.translation].sort(() => Math.random() - 0.5);
      return { wordId: w.id, word: w.word, options: opts };
    });
  });

  const [answers,  setAnswers]  = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score,    setScore]    = useState(0);

  const submitMut = useMutation({
    mutationFn: () => api.post('/gamification/vocab/test', { answers }),
    onSuccess:  (res: { data: { score: number } }) => {
      setScore(res.data.score);
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ['vocab-words'] });
      qc.invalidateQueries({ queryKey: ['point-logs'] });
    },
  });

  const answered = Object.keys(answers).length;

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-5">
        <div className="text-5xl">{score >= 80 ? '🎉' : score >= 60 ? '👍' : '😔'}</div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {score}%
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {score >= 80 ? '+50 ⭐ ball olindingiz!' : 'Davom eting, yaxshilaning!'}
          </p>
        </div>
        <button onClick={onBack} className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          ← Lug'atga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          ← Orqaga
        </button>
        <span className="text-xs text-gray-400">{answered}/{questions.length} javob</span>
      </div>

      <div className="space-y-5">
        {questions.map((q, i) => (
          <div key={q.wordId} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              <span className="text-gray-400 mr-2">{i + 1}.</span>
              "{q.word}" — tarjimasi?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => setAnswers(a => ({ ...a, [q.wordId]: opt }))}
                  className={`px-3 py-2 text-sm rounded-xl text-left border transition-all ${
                    answers[q.wordId] === opt
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => submitMut.mutate()}
          disabled={answered < questions.length || submitMut.isPending}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
        >
          {submitMut.isPending ? 'Topshirilmoqda...' : '✓ Testni topshirish'}
        </button>
      </div>
    </div>
  );
}

// ─── So'z qo'shish ────────────────────────────────────────────────────────────
function AddWordModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [word,  setWord]  = useState('');
  const [trans, setTrans] = useState('');
  const [ex,    setEx]    = useState('');
  const [ai,    setAi]    = useState(false);

  const mut = useMutation({
    mutationFn: () => api.post('/gamification/vocab', {
      word: word.trim(),
      translation: trans.trim(),
      exampleSentence: ex.trim() || undefined,
      generateAiDefinition: ai,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vocab-words'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">📚 Yangi so'z</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input value={word} onChange={e => setWord(e.target.value)} placeholder="So'z (inglizcha) *"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input value={trans} onChange={e => setTrans(e.target.value)} placeholder="Tarjimasi (o'zbekcha) *"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input value={ex} onChange={e => setEx(e.target.value)} placeholder="Misol jumla (ixtiyoriy)"
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)}
            className="w-4 h-4 accent-emerald-600" />
          <span className="text-sm text-gray-700">🤖 AI ta'rif yaratish</span>
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">Bekor</button>
          <button
            onClick={() => { if (word && trans) mut.mutate(); }}
            disabled={mut.isPending || !word || !trans}
            className="px-5 py-2 text-sm font-medium bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
          >
            {mut.isPending ? '...' : "Qo'shish"}
          </button>
        </div>
      </div>
    </div>
  );
}

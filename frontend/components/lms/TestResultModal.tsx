'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { useEffect, useState } from 'react';
import { scoreToLevel, DIFFICULTY_META } from '@/types/lms';
import type { Test, TestSubmitResponse, TestTakeQuestion } from '@/types/lms';

interface Props {
  test:        Test;
  result:      TestSubmitResponse;
  questions:   TestTakeQuestion[];
  outOfHearts: boolean;
  onClose:     () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}d ${s}s`;
}

export default function TestResultModal({ test, result, questions, outOfHearts, onClose }: Props) {
  const level = scoreToLevel(result.score);

  // Ball animatsiyasi — 0 dan pointsEarned gacha sanaydi
  const [animatedPoints, setAnimatedPoints] = useState(0);
  useEffect(() => {
    if (result.pointsEarned <= 0) return;
    const duration = 800;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setAnimatedPoints(Math.round(t * result.pointsEarned));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result.pointsEarned]);

  // Daraja bo'yicha to'g'ri javoblar % — checkedAnswers + savol difficulty asosida
  const diffStats = (['easy', 'medium', 'hard'] as const)
    .map(diff => {
      const qs = questions.filter(q => q.difficulty === diff);
      if (qs.length === 0) return null;
      const correct = qs.filter(q => result.checkedAnswers[q.id]?.correct).length;
      return { subject: DIFFICULTY_META[diff].label, score: Math.round((correct / qs.length) * 100) };
    })
    .filter((d): d is { subject: string; score: number } => d !== null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Sarlavha */}
        <div className={`px-6 pt-6 pb-5 rounded-t-3xl ${outOfHearts ? 'bg-red-50' : level.bg}`}>
          <div className="text-center">
            <div className="text-5xl mb-2">
              {outOfHearts ? '💔' : result.score >= 90 ? '🏆' : result.score >= 60 ? '🎉' : '💪'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {outOfHearts ? 'Jonlaringiz tugadi' : 'Test yakunlandi!'}
            </h2>
            <p className="text-sm text-gray-500">{test.title}</p>
          </div>

          {/* Asosiy ball */}
          <div className="flex items-center justify-center gap-6 mt-5">
            <div className="text-center">
              <div className={`text-4xl font-bold ${level.color}`}>
                {result.score.toFixed(0)}%
              </div>
              <div className={`text-xs font-medium mt-1 px-3 py-1 rounded-full ${level.bg} ${level.color}`}>
                {result.level}
              </div>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(result.timeSpentSeconds)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Sarflangan vaqt</div>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {result.earnedPoints}/{result.totalPoints}
              </div>
              <div className="text-xs text-gray-500 mt-1">To'g'ri javob</div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 space-y-5">
          {/* Ball animatsiyasi (90%+ bonus) */}
          {result.pointsEarned > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
              <span className="text-2xl">🌟</span>
              <span className="text-lg font-bold text-amber-700">+{animatedPoints} ball to'plandi!</span>
            </div>
          )}

          {/* Shubhali faollik ogohlantirishi */}
          {result.cheatingFlag && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 text-amber-700 text-xs font-medium">
              <AlertTriangle size={14} className="shrink-0" />
              Shubhali faollik aniqlandi — javoblar juda tez berilgan
            </div>
          )}

          {/* Radar chart */}
          {diffStats.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ko'nikmalar tahlili</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={diffStats}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                    />
                    <Radar
                      name="Ball"
                      dataKey="score"
                      fill="#10b981"
                      fillOpacity={0.25}
                      stroke="#059669"
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Savollar ko'rinishi */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Savollar ({questions.length})</h3>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => {
                const checked = result.checkedAnswers[q.id];
                const cls = !checked
                  ? 'bg-gray-50 text-gray-400 border-gray-200'
                  : checked.correct
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200';
                return (
                  <div
                    key={q.id}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${cls}`}
                    title={`Savol ${i + 1}${!checked ? " — javob berilmadi" : checked.correct ? " — to'g'ri" : ' — xato'}`}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3">
              {(['easy', 'medium', 'hard'] as const).map(d => {
                const cnt = questions.filter(q => q.difficulty === d).length;
                return cnt > 0 ? (
                  <span key={d} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_META[d].bg} ${DIFFICULTY_META[d].color}`}>
                    {DIFFICULTY_META[d].label}: {cnt}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        </div>

        {/* Yopish */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

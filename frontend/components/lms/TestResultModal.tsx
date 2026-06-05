'use client';

import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from 'recharts';
import { scoreToLevel, DIFFICULTY_META } from '@/types/lms';
import type { Test, TestResult, TestQuestion } from '@/types/lms';

interface Props {
  test:      Test;
  result:    TestResult;
  questions: TestQuestion[];
  answers:   Record<string, number>;
  onClose:   () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}d ${s}s`;
}

export default function TestResultModal({ test, result, questions, answers, onClose }: Props) {
  const level    = scoreToLevel(result.score);
  const passed   = result.passed;

  // Daraja bo'yicha to'g'ri javoblar
  const diffStats = (['easy', 'medium', 'hard'] as const).map(diff => {
    const qs      = questions.filter(q => q.difficulty === diff);
    const correct = qs.filter((q, _i) => {
      // Javob to'g'ri tekshirish backenddan keladi — bu yerda faqat ko'rsatamiz
      return answers[q.id] !== undefined;
    }).length;
    return {
      subject: DIFFICULTY_META[diff].label,
      score:   qs.length > 0 ? Math.round((correct / qs.length) * 100) : 0,
    };
  });

  // categoryScores dan radar data
  const radarData = result.categoryScores
    ? Object.entries(result.categoryScores).map(([key, val]) => ({
        subject: key,
        score:   Math.round(val),
      }))
    : diffStats;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Sarlavha */}
        <div className={`px-6 pt-6 pb-5 rounded-t-3xl ${passed ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <div className="text-center">
            <div className="text-5xl mb-2">{passed ? '🎉' : '😔'}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {passed ? "Test muvaffaqiyatli topshirildi!" : "Test o'tmadi"}
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
                {level.label}
              </div>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(result.timeSpentSec)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Sarflangan vaqt</div>
            </div>
            <div className="w-px h-12 bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {test.passScore}%
              </div>
              <div className="text-xs text-gray-500 mt-1">O'tish bali</div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 space-y-5">
          {/* Radar chart */}
          {radarData.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 Ko'nikmalar tahlili</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
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

          {/* Anti-cheat log */}
          {result.anticheatFlags && result.anticheatFlags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">⚠️ Anti-cheat hisoboti</h3>
              <div className="space-y-1.5">
                {result.anticheatFlags.map((flag, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                      flag.severity === 'high'   ? 'bg-red-50 text-red-700' :
                      flag.severity === 'medium' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{
                        flag.type === 'tab_switch'    ? '🔄 Tab almashtirish' :
                        flag.type === 'fast_answer'   ? '⚡ Juda tez javob'  :
                        flag.type === 'copy_pattern'  ? '📋 Nusxa ko\'chirish' :
                        '⏸ Uzoq pauza'
                      }</span>
                      {flag.details && <span className="opacity-70">— {flag.details}</span>}
                    </div>
                    <span className="font-semibold">{flag.count} ta</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Savollar ko'rinishi */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">📋 Savollar ({questions.length})</h3>
            <div className="flex flex-wrap gap-2">
              {questions.map((q, i) => {
                const answered = answers[q.id] !== undefined;
                const diffMeta = DIFFICULTY_META[q.difficulty];
                return (
                  <div
                    key={q.id}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border ${
                      answered
                        ? `${diffMeta.bg} ${diffMeta.color} border-transparent`
                        : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}
                    title={`Savol ${i + 1}: ${diffMeta.label}${answered ? ' — Javob berildi' : ' — Javob berilmadi'}`}
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
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

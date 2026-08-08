'use client';

import type { Subject } from '@/types/lms';
import { getSubjectVisual } from '@/types/lms';

interface Props {
  subject:  Subject;
  active:   boolean;
  onClick:  (s: Subject) => void;
}

export default function SubjectCard({ subject, active, onClick }: Props) {
  const avg = subject.stats?.avgScore;
  const visual = getSubjectVisual(subject);

  return (
    <button
      onClick={() => onClick(subject)}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-2xl transition-all border ${
        active
          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0`}
        style={{ background: visual.color + '20' }}
      >
        <visual.icon size={14} className="shrink-0" />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${active ? 'text-emerald-800' : 'text-gray-900'}`}>
          {subject.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {subject.stats && (
            <>
              <span className="text-[10px] text-gray-400">{subject.stats.materialsCount} material</span>
              <span className="text-gray-200 text-[10px]">·</span>
              <span className="text-[10px] text-gray-400">{subject.stats.testsCount} test</span>
            </>
          )}
        </div>
      </div>

      {/* Ball indikator */}
      {avg != null && (
        <div className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
          avg >= 80 ? 'bg-green-100 text-green-700'
          : avg >= 60 ? 'bg-amber-100 text-amber-700'
          : 'bg-red-100 text-red-700'
        }`}>
          {avg.toFixed(0)}%
        </div>
      )}
    </button>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
export function SubjectCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-gray-100 bg-white animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

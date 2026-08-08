'use client';

import { FileText, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TEST_STATUS_META, scoreToLevel } from '@/types/lms';
import type { Test, TestStatus } from '@/types/lms';
import TestRunner from './TestRunner';
import CreateTestModal from './CreateTestModal';

interface Props {
  subjectId:   string;
  groupId:     string | null;
  canCreate:   boolean;
  canApprove:  boolean;
}

const STATUS_FILTERS: Array<{ value: TestStatus | 'all'; label: string }> = [
  { value: 'all',       label: 'Barchasi'    },
  { value: 'published', label: 'Nashr'       },
  { value: 'review',    label: 'Tekshiruvda' },
  { value: 'draft',     label: 'Qoralama'    },
];

export default function TestsTab({ subjectId, groupId, canCreate, canApprove }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TestStatus | 'all'>('published');
  const [activeTest,   setActiveTest]   = useState<Test | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['tests', subjectId, groupId],
    queryFn:  () => api.get<Test[]>('/tests', {
      params: { subjectId },
    }).then(r => r.data),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/tests/${id}/status`, { status: 'published' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/tests/${id}/status`, { status: 'archived' }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] }),
  });

  const filtered = statusFilter === 'all'
    ? tests
    : tests.filter(t => t.status === statusFilter);

  if (activeTest) {
    return (
      <TestRunner
        test={activeTest}
        onClose={() => {
          setActiveTest(null);
          qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] });
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Yuqori panel */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value as TestStatus | 'all')}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                statusFilter === f.value
                  ? 'bg-primary-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            <Pencil size={14} /> Test draft
          </button>
        )}
      </div>

      {/* Testlar ro'yxati */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
          <div className="text-4xl"><FileText size={36} /></div>
          <p className="text-sm">Testlar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(test => {
            const sMeta      = TEST_STATUS_META[test.status];
            const result     = test.myResult;
            const attemptsLeft = test.myAttemptsLeft ?? test.maxAttempts;
            const canTake    = test.status === 'published' && attemptsLeft > 0;

            return (
              <div
                key={test.id}
                className="bg-white border border-gray-100 rounded-2xl px-5 py-4 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm">{test.title}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${sMeta.bg} ${sMeta.color}`}>
                        {sMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-gray-400">⏱ {test.timeLimitMinutes} daq</span>
                      <span className="text-xs text-gray-400">{test.questionsToShow}/{test.totalQuestions} savol</span>
                      <span className="text-xs text-gray-400">{attemptsLeft}/{test.maxAttempts} urinish qoldi</span>
                      {test.createdBy && (
                        <span className="text-xs text-gray-400">
                          {test.createdBy.firstName} {test.createdBy.lastName[0]}.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Natija yoki boshlash */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {result ? (
                      <div className="text-right">
                        <div className={`text-lg font-bold ${scoreToLevel(result.score).color}`}>
                          {result.score.toFixed(0)}%
                        </div>
                        <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${scoreToLevel(result.score).bg} ${scoreToLevel(result.score).color}`}>
                          {scoreToLevel(result.score).label}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex gap-2">
                      {canApprove && test.status === 'review' && (
                        <button
                          onClick={() => approveMut.mutate(test.id)}
                          disabled={approveMut.isPending}
                          className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                        >
                          Tasdiqlash
                        </button>
                      )}
                      {canApprove && test.status === 'published' && (
                        <button
                          onClick={() => archiveMut.mutate(test.id)}
                          disabled={archiveMut.isPending}
                          className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          Arxiv
                        </button>
                      )}
                      {canTake && (
                        <button
                          onClick={() => setActiveTest(test)}
                          className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-xl transition-colors font-medium"
                        >
                          {result ? 'Qayta urinish' : '▶ Boshlash'}
                        </button>
                      )}
                      {!canTake && test.status === 'published' && attemptsLeft === 0 && result && (
                        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl">
                          Urinish qolmadi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {createOpen && (
        <CreateTestModal
          subjectId={subjectId}
          groupId={groupId}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

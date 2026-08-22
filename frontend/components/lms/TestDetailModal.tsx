'use client';

import { X, Settings, BarChart3, History } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TEST_STATUS_META } from '@/types/lms';
import type { TestWithQuestions } from '@/types/lms';
import CreateTestModal from './CreateTestModal';
import TestResultsPanel from './TestResultsPanel';
import TestHistoryPanel from './TestHistoryPanel';

interface Props {
  testId?:    string;   // yo'q = yangi test yaratish rejimi
  subjectId:  string;
  groupId:    string | null;
  role:       string;
  userId?:    string;
  canApprove: boolean;
  onClose:    () => void;
}

type Tab = 'settings' | 'results' | 'history';

// Test kartasi bosilganda ochiladigan yagona joy: sozlamalar (tahrirlash),
// natijalar, tarix — avval kartaning o'zida sochilgan tugmalar (Arxiv,
// Natijalar) endi shu yerga jamlangan
export default function TestDetailModal({ testId, subjectId, groupId, role, userId, canApprove, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('settings');
  const isCreate = !testId;

  const { data: test, isLoading } = useQuery({
    queryKey: ['test-detail', testId],
    queryFn:  () => api.get<TestWithQuestions>(`/tests/${testId}`).then(r => r.data),
    enabled:  !!testId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] });
    qc.invalidateQueries({ queryKey: ['test-detail', testId] });
    qc.invalidateQueries({ queryKey: ['subjects'] });
  };

  const sendToReviewMut = useMutation({
    mutationFn: () => api.patch(`/tests/${testId}/status`, { status: 'review' }),
    onSuccess:  invalidateAll,
  });
  const approveMut = useMutation({
    mutationFn: () => api.patch(`/tests/${testId}/status`, { status: 'published' }),
    onSuccess:  invalidateAll,
  });
  const archiveMut = useMutation({
    mutationFn: () => api.patch(`/tests/${testId}/status`, { status: 'archived' }),
    onSuccess:  invalidateAll,
  });
  const unarchiveMut = useMutation({
    mutationFn: () => api.patch(`/tests/${testId}/status`, { status: 'published' }),
    onSuccess:  invalidateAll,
  });
  const duplicateMut = useMutation({
    mutationFn: () => api.post(`/tests/${testId}/duplicate`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tests', subjectId, groupId] });
      onClose();
    },
  });

  // Yangi test yaratish — o'ziga xos to'liq modal (sarlavha, backdrop bilan),
  // hech qanday tab kerak emas
  if (isCreate) {
    return (
      <CreateTestModal
        subjectId={subjectId}
        groupId={groupId}
        onClose={onClose}
      />
    );
  }

  const canViewResults = canApprove || (role === 'ustoz' && test?.createdById === userId);
  const canViewHistory = role === 'super_admin' || role === 'manager';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {isLoading || !test ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Sarlavha + holat amallari */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 truncate">{test.title}</h2>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TEST_STATUS_META[test.status].bg} ${TEST_STATUS_META[test.status].color}`}>
                    {TEST_STATUS_META[test.status].label}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {test.questionCount} savol · {test.timeLimitMinutes} daq
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {test.status === 'draft' && (canApprove || test.createdById === userId) && (
                  <button
                    onClick={() => sendToReviewMut.mutate()}
                    disabled={sendToReviewMut.isPending}
                    className="text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    Tekshiruvga yuborish
                  </button>
                )}
                {canApprove && test.status === 'review' && (
                  <button
                    onClick={() => approveMut.mutate()}
                    disabled={approveMut.isPending}
                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    Tasdiqlash
                  </button>
                )}
                {canApprove && test.status === 'published' && (
                  <button
                    onClick={() => archiveMut.mutate()}
                    disabled={archiveMut.isPending}
                    className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    Arxiv
                  </button>
                )}
                {canApprove && test.status === 'archived' && (
                  <button
                    onClick={() => unarchiveMut.mutate()}
                    disabled={unarchiveMut.isPending}
                    className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                  >
                    Arxivdan qaytarish
                  </button>
                )}
                <button
                  onClick={() => duplicateMut.mutate()}
                  disabled={duplicateMut.isPending}
                  className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  Nusxalash
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
              </div>
            </div>

            {/* Tab almashtirgich */}
            <div className="flex gap-1.5 px-6 pt-4 shrink-0">
              <button
                onClick={() => setTab('settings')}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                  tab === 'settings'
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Settings size={13} /> Sozlamalar
              </button>
              {canViewResults && (
                <button
                  onClick={() => setTab('results')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                    tab === 'results'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <BarChart3 size={13} /> Natijalar
                </button>
              )}
              {canViewHistory && (
                <button
                  onClick={() => setTab('history')}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                    tab === 'history'
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <History size={13} /> Tarix
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden px-6 py-4">
              {tab === 'settings' && (
                <CreateTestModal
                  subjectId={test.subjectId}
                  groupId={groupId}
                  test={test}
                  onClose={onClose}
                  onSaved={invalidateAll}
                />
              )}
              {tab === 'results' && canViewResults && <TestResultsPanel testId={test.id} />}
              {tab === 'history' && canViewHistory && <TestHistoryPanel entityId={test.id} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

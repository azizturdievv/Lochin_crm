'use client';

import { History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

interface AuditLogEntry {
  id:         string;
  userEmail:  string | null;
  userRole:   string | null;
  action:     string;
  oldValues:  Record<string, unknown> | null;
  newValues:  Record<string, unknown> | null;
  createdAt:  string;
}

interface Props {
  entityId: string;
}

const ACTION_LABELS: Record<string, string> = {
  TEST_CREATED:              'Test yaratildi',
  TEST_UPDATED:              'Sozlamalar tahrirlandi',
  TEST_STATUS_CHANGED:       'Holat o\'zgardi',
  TEST_DUPLICATED:           'Nusxalandi',
  TEST_RESULTS_RELEASED:     'Natijalar ochildi',
  TEST_ATTEMPT_GRANTED:      'Qo\'shimcha urinish berildi',
  TEST_QUESTION_ADDED:       'Savol qo\'shildi',
  TEST_QUESTION_UPDATED:     'Savol tahrirlandi',
  TEST_QUESTION_ANSWER_CHANGED: 'Savol javobi o\'zgartirildi',
  TEST_QUESTION_DELETED:     'Savol o\'chirildi',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Test bilan bog'liq barcha amallar tarixi — AuditLogService allaqachon
// hamma narsani yozadi, bu yerda faqat shu test uchun filtrlab ko'rsatiladi
export default function TestHistoryPanel({ entityId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', 'tests', entityId],
    queryFn:  () => api.get<{ data: AuditLogEntry[] }>('/audit-log', {
      params: { entityName: 'tests', entityId, limit: 50 },
    }).then(r => r.data.data),
  });

  const entries = data ?? [];

  return (
    <div className="h-full overflow-y-auto space-y-2">
      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
          <History size={28} />
          <p className="text-sm">Hali tarix yo&apos;q</p>
        </div>
      ) : (
        entries.map(e => (
          <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-gray-100">
            <div className="min-w-0">
              <p className="text-sm text-gray-800">{ACTION_LABELS[e.action] ?? e.action}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {e.userEmail ?? "Noma'lum"} {e.userRole && `(${e.userRole})`}
              </p>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">{formatDate(e.createdAt)}</span>
          </div>
        ))
      )}
    </div>
  );
}

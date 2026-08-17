'use client';

import { CalendarCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/store/toast.store';
import type { MonthGenerationStatus, GenerateMonthResponse } from '@/types/schedule';

const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_UZ[m - 1]} ${y}`;
}

interface Props {
  month: string; // "YYYY-MM"
}

export default function GenerateMonthBanner({ month }: Props) {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  const { data: statuses } = useQuery({
    queryKey: ['month-status', month],
    queryFn: () => api.get<MonthGenerationStatus[]>('/schedule/month-status', { params: { month } }).then(r => r.data),
  });

  const genMut = useMutation({
    mutationFn: (groupId?: string) =>
      api.post<GenerateMonthResponse>('/schedule/generate-month', { month, ...(groupId && { groupId }) }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['week-schedule'] });
      qc.invalidateQueries({ queryKey: ['month-status'] });
      const created = data.results.reduce((s, r) => s + r.created, 0);
      const skipped = data.results.reduce((s, r) => s + r.skipped, 0);
      toast.success(
        skipped > 0
          ? `${created} ta dars yaratildi, ${skipped} ta to'qnashuv sababli o'tkazib yuborildi`
          : `${created} ta dars yaratildi`,
      );
      setBusyGroup(null);
    },
    onError: () => { toast.error('Jadval yaratishda xatolik'); setBusyGroup(null); },
  });

  if (!statuses?.length || dismissed === month) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0">
          <CalendarCheck size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {monthLabel(month)} uchun {statuses.length} ta guruhning jadvali to&apos;liq emas
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Kun/vaqt/xonani o&apos;zgartirish kerak bo&apos;lsa avval{' '}
              <a href="/dashboard/groups" className="underline font-medium">Guruhlar</a> bo&apos;limida
              sozlamalarni yangilang, so&apos;ng quyidagilardan birini bosing.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {statuses.map(s => (
                <button
                  key={s.groupId}
                  onClick={() => { setBusyGroup(s.groupId); genMut.mutate(s.groupId); }}
                  disabled={genMut.isPending}
                  className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded-lg text-amber-800 hover:bg-amber-100 transition disabled:opacity-50"
                >
                  {busyGroup === s.groupId && genMut.isPending ? '...' : `${s.groupName} (${s.missing} ta yetishmayapti)`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={() => { setBusyGroup('__all__'); genMut.mutate(undefined); }}
            disabled={genMut.isPending}
            className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition disabled:opacity-60 whitespace-nowrap"
          >
            {busyGroup === '__all__' && genMut.isPending ? 'Yaratilmoqda...' : 'Barchasini yaratish'}
          </button>
          <button onClick={() => setDismissed(month)} className="text-amber-400 hover:text-amber-600 shrink-0">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

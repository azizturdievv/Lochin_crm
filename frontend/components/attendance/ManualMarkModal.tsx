'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { STATUS_META } from '@/types/attendance';
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance';

interface Props {
  record:  AttendanceRecord | null;
  lessonId: string;
  onClose: () => void;
}

const STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'unexcused'];

export default function ManualMarkModal({ record, lessonId, onClose }: Props) {
  const qc = useQueryClient();
  const [status,      setStatus]      = useState<AttendanceStatus>(record?.status ?? 'present');
  const [lateMinutes, setLateMinutes] = useState(record?.lateMinutes ?? 0);
  const [excuseReason,setExcuseReason]= useState('');
  const [error,       setError]       = useState('');

  const markMut = useMutation({
    mutationFn: (data: object) => api.post('/attendance/manual', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lesson-attendance', lessonId] });
      qc.invalidateQueries({ queryKey: ['today-attendance'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  if (!record) return null;

  const fullName = `${record.student.lastName} ${record.student.firstName}`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    markMut.mutate({
      lessonId,
      studentId:   record!.studentId,
      status,
      ...(status === 'late' && lateMinutes > 0 && { lateMinutes }),
      ...(status === 'excused' && excuseReason && { excuseReason }),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Davomat belgilash</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fullName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Holat tanlash */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Holat</label>
            <div className="grid grid-cols-1 gap-2">
              {STATUSES.map(s => {
                const meta = STATUS_META[s];
                return (
                  <button key={s} type="button" onClick={() => setStatus(s)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      status === s
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}>
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    {record.status === s && (
                      <span className="ml-auto text-xs text-gray-400">(joriy)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kech daqiqa */}
          {status === 'late' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Necha daqiqa kech</label>
              <input
                type="number" min={1} max={120}
                value={lateMinutes}
                onChange={e => setLateMinutes(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0"
              />
            </div>
          )}

          {/* Sabab (sababli uchun) */}
          {status === 'excused' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sabab (ixtiyoriy)</label>
              <textarea
                value={excuseReason}
                onChange={e => setExcuseReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Sabab izohini kiriting..."
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={markMut.isPending}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
              {markMut.isPending ? 'Saqlanmoqda...' : '✓ Saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

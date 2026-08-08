'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { AttendanceRecord } from '@/types/attendance';

interface Props {
  record:   AttendanceRecord | null;
  lessonId: string;
  onClose:  () => void;
}

export default function ExcuseModal({ record, lessonId, onClose }: Props) {
  const qc = useQueryClient();
  const [reason, setReason]     = useState('');
  const [docUrl, setDocUrl]     = useState('');
  const [error,  setError]      = useState('');

  const excuseMut = useMutation({
    mutationFn: (data: { reason: string; documentUrl?: string }) =>
      api.patch(`/attendance/${record!.id}/excuse`, data).then(r => r.data),
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
    if (reason.trim().length < 10) {
      return setError('Sabab kamida 10 ta belgi bo\'lishi kerak');
    }
    excuseMut.mutate({ reason: reason.trim(), ...(docUrl && { documentUrl: docUrl }) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Sabab kiritish</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fullName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            Ota-ona tomonidan kiritilgan sabab davomat holatini <strong>"Sababli"</strong> ga o'zgartiradi.
          </div>

          {/* Sabab */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Sabab * <span className="text-gray-400">(kamida 10 belgi)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Masalan: Kasal bo'lgani sababli kela olmadi. Vrach ko'rigi bor edi."
            />
            <p className="text-xs text-gray-400 mt-1">{reason.length}/10+ belgi</p>
          </div>

          {/* Hujjat URL (ixtiyoriy) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Hujjat URL <span className="text-gray-400">(ixtiyoriy)</span>
            </label>
            <input
              type="url"
              value={docUrl}
              onChange={e => setDocUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={excuseMut.isPending || reason.length < 10}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
              {excuseMut.isPending ? 'Saqlanmoqda...' : 'Sabab yuborish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

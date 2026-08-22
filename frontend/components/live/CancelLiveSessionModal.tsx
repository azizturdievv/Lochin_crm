'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { LiveSession } from '@/types/live-sessions';

interface Props {
  session: LiveSession;
  onClose: () => void;
}

export default function CancelLiveSessionModal({ session, onClose }: Props) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');

  const cancelMut = useMutation({
    mutationFn: () => api.post(`/live-sessions/${session.id}/cancel`, { reason: reason.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['live-sessions'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Bekor qilishda xatolik yuz berdi'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Darsni bekor qilish</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            "{session.title}" bekor qilinsinmi? Bu amalni qaytarib bo'lmaydi.
          </p>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Sabab (ixtiyoriy)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Masalan: ustoz kasal, vaqt to'qnashuvi..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Orqaga
          </button>
          <button
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
            className="px-5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {cancelMut.isPending ? 'Bekor qilinmoqda...' : 'Bekor qilish'}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

interface Props {
  open:      boolean;
  studentId: string;
  onClose:   () => void;
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

export default function ExtendPaymentModal({ open, studentId, onClose }: Props) {
  const qc = useQueryClient();
  const [until,  setUntil]  = useState('');
  const [reason, setReason] = useState('');
  const [msg,    setMsg]    = useState('');

  const extendMut = useMutation({
    mutationFn: () => api.patch(`/payments/students/${studentId}/extend`, { until, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-debtor-status', studentId] });
      qc.invalidateQueries({ queryKey: ['payment-access-status', studentId] });
      setUntil('');
      setReason('');
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setMsg(e.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Muddatni uzaytirish</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-gray-400">
            Belgilangan sanagacha o'quvchi ilovasi to'lov holatidan qat'i nazar ochiq turadi.
          </p>

          <div>
            <label className={LABEL}>Qaysi sanagacha</label>
            <input
              type="date"
              className={INPUT}
              value={until}
              onChange={e => setUntil(e.target.value)}
            />
          </div>

          <div>
            <label className={LABEL}>Sabab</label>
            <textarea
              className={INPUT}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Masalan: ota-ona bilan kelishilgan, 3 kunga uzaytirildi"
            />
          </div>

          {msg && <p className="text-xs text-red-600">{msg}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Bekor
          </button>
          <button
            onClick={() => { setMsg(''); extendMut.mutate(); }}
            disabled={extendMut.isPending || !until || reason.trim().length < 5}
            className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            {extendMut.isPending ? 'Saqlanmoqda...' : 'Uzaytirish'}
          </button>
        </div>
      </div>
    </div>
  );
}

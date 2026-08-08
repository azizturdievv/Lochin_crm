'use client';

import { AlertTriangle, Check, Circle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { InstallmentPlan } from '@/types/payments';

interface Props {
  open:    boolean;
  onClose: () => void;
}

function addMonths(date: Date, n: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default function InstallmentModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const [studentSearch, setStudentSearch] = useState('');
  const [studentId,     setStudentId]     = useState('');
  const [studentName,   setStudentName]   = useState('');
  const [total,         setTotal]         = useState('');
  const [parts,         setParts]         = useState<2|3|4>(2);
  const [description,   setDescription]   = useState('');
  const [error,         setError]         = useState('');

  const totalNum = parseFloat(total.replace(/\s/g,'')) || 0;
  const today    = new Date();

  // Auto schedule
  const schedule = Array.from({ length: parts }, (_, i) => {
    const rem  = totalNum % parts;
    const base = Math.floor(totalNum / parts);
    return { part: i + 1, amount: i === parts - 1 ? base + rem : base, dueDate: addMonths(today, i + 1) };
  });

  const { data: students } = useQuery({
    queryKey: ['students-search-inst', studentSearch],
    queryFn:  () => api.get('/students', { params: { search: studentSearch, limit: 8, isActive: true } }).then(r => r.data.data),
    enabled:  studentSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: (data: object) => api.post('/payments/installments', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e?.response?.data?.message ?? 'Xatolik yuz berdi');
    },
  });

  useEffect(() => {
    if (!open) {
      setStudentId(''); setStudentName(''); setStudentSearch('');
      setTotal(''); setParts(2); setDescription(''); setError('');
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!studentId)      return setError('O\'quvchini tanlang');
    if (totalNum <= 0)   return setError('Umumiy summani kiriting');
    createMut.mutate({ studentId, totalAmount: totalNum, partsCount: parts, schedule, description });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Muddatli to'lov</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* O'quvchi */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">O'quvchi *</label>
            <input
              value={studentName || studentSearch}
              onChange={e => { setStudentSearch(e.target.value); setStudentId(''); setStudentName(''); }}
              placeholder="Ism yoki telefon..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {students?.length > 0 && !studentId && (
              <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden">
                {students.map((s: { id: string; firstName: string; lastName: string }) => (
                  <button key={s.id} type="button"
                    onClick={() => { setStudentId(s.id); setStudentName(`${s.lastName} ${s.firstName}`); setStudentSearch(''); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0">
                    {s.lastName} {s.firstName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Umumiy summa */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Umumiy summa (so'm) *</label>
            <input
              type="number"
              min={0}
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Qismlar soni */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Qismlar soni *</label>
            <div className="grid grid-cols-3 gap-2">
              {([2, 3, 4] as const).map(n => (
                <button key={n} type="button" onClick={() => setParts(n)}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    parts === n ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {n} qism
                </button>
              ))}
            </div>
          </div>

          {/* Jadval preview */}
          {totalNum > 0 && (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200">
                <p className="text-xs font-medium text-gray-600">To'lov jadvali (avtomatik)</p>
              </div>
              <div className="divide-y divide-gray-200">
                {schedule.map(item => (
                  <div key={item.part} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{item.part}</span>
                      <span className="text-xs text-gray-500">{new Date(item.dueDate).toLocaleDateString('uz-UZ', { month:'short', day:'numeric', year:'numeric' })}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.amount.toLocaleString('uz-UZ')} so'm</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Izoh */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Izoh</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ixtiyoriy" />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
              {createMut.isPending ? 'Yaratilmoqda...' : 'Yaratish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MUDDATLI TO'LOV KARTASI ──────────────────────────────────────────────────
export function InstallmentCard({ plan }: { plan: InstallmentPlan }) {
  const paid    = plan.schedule.filter(s => s.isPaid).length;
  const overdue = plan.schedule.filter(s => !s.isPaid && new Date(s.dueDate) < new Date()).length;
  const pct     = Math.round((paid / plan.partsCount) * 100);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">
          {plan.partsCount} qismli to'lov
        </p>
        <span className="text-xs text-gray-400">{paid}/{plan.partsCount} to'landi</span>
      </div>

      {/* Progress */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {overdue > 0 && (
        <p className="text-xs text-red-600 font-medium">{overdue} ta muddati o'tgan</p>
      )}

      {/* Qismlar */}
      <div className="space-y-1.5">
        {plan.schedule.map(item => {
          const isOverdue = !item.isPaid && new Date(item.dueDate) < new Date();
          return (
            <div key={item.part} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${
              item.isPaid ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-gray-50'
            }`}>
              <span className={item.isPaid ? 'text-emerald-600' : isOverdue ? 'text-red-600' : 'text-gray-600'}>
                {item.isPaid ? <Check size={12} className="inline" /> : isOverdue ? <AlertTriangle size={12} className="inline" /> : <Circle size={10} className="inline" />} {item.part}-qism
              </span>
              <span className={`font-medium ${item.isPaid ? 'text-emerald-700' : isOverdue ? 'text-red-700' : 'text-gray-700'}`}>
                {item.amount.toLocaleString('uz-UZ')} so'm
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

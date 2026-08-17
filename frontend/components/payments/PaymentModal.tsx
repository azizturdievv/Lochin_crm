'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import CashDenomination, { calcDenomTotal } from './CashDenomination';
import type { PaymentMethod, CashBreakdown } from '@/types/payments';
import { METHOD_META, CASH_DENOMINATIONS } from '@/types/payments';

const schema = z.object({
  studentId:    z.string().uuid('O\'quvchi tanlang'),
  amount:       z.number().positive('Musbat bo\'lishi kerak'),
  method:       z.enum(['cash','card','bank','payme','click','mixed']),
  paymentMonth: z.string().optional(),
  notes:        z.string().optional(),
  cashAmount:   z.number().min(0).optional(),
  cardAmount:   z.number().min(0).optional(),
  printReceipt: z.boolean().optional(),
});

type Form = z.infer<typeof schema>;

interface Props {
  open:    boolean;
  onClose: () => void;
  onSuccess?: (paymentId: string) => void;
  cashSessionId?: string;
}

const METHODS: PaymentMethod[] = ['cash','card','bank','payme','click','mixed'];
const INPUT  = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white';
const LABEL  = 'block text-xs font-medium text-gray-600 mb-1';

export default function PaymentModal({ open, onClose, onSuccess, cashSessionId }: Props) {
  const qc = useQueryClient();

  const [method,    setMethod]    = useState<PaymentMethod>('cash');
  const [denom,     setDenom]     = useState<Record<number, number>>({});
  const [studentSearch, setStudentSearch] = useState('');

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'cash', printReceipt: true },
  });

  const watchCash = form.watch('cashAmount') ?? 0;
  const watchCard = form.watch('cardAmount') ?? 0;

  useEffect(() => {
    if (!open) {
      form.reset({ method: 'cash', printReceipt: true });
      setMethod('cash');
      setDenom({});
      setStudentSearch('');
    }
  }, [open, form]);

  useEffect(() => {
    form.setValue('method', method);
    if (method === 'mixed') {
      form.setValue('amount', watchCash + watchCard);
    }
  }, [method, form]);

  useEffect(() => {
    if (method === 'mixed') {
      form.setValue('amount', watchCash + watchCard);
    }
  }, [watchCash, watchCard, method, form]);

  useEffect(() => {
    if (method === 'cash') {
      const total = calcDenomTotal(denom);
      if (total > 0) form.setValue('amount', total);
    }
  }, [denom, method, form]);

  // O'quvchi qidiruvi
  const { data: students } = useQuery({
    queryKey: ['students-search', studentSearch],
    queryFn:  () => api.get('/students', { params: { search: studentSearch, limit: 10, isActive: true } }).then(r => r.data.data),
    enabled:  studentSearch.length >= 2,
  });

  const createMut = useMutation({
    mutationFn: (data: Form & { cashBreakdown?: Record<string, number>; cashSessionId?: string }) =>
      api.post('/payments', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
      qc.invalidateQueries({ queryKey: ['active-session'] });
      onSuccess?.(data.id);
      onClose();
    },
  });

  function onSubmit(data: Form) {
    const breakdown: Record<string, number> = {};
    CASH_DENOMINATIONS.forEach(d => {
      if ((denom[d] ?? 0) > 0) breakdown[String(d)] = denom[d];
    });

    createMut.mutate({
      ...data,
      ...(Object.keys(breakdown).length > 0 && { cashBreakdown: breakdown }),
      ...(cashSessionId && { cashSessionId }),
    });
  }

  if (!open) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">To'lov qabul qilish</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── O'QUVCHI TANLASH ─────────────────────────────────────── */}
          <div>
            <label className={LABEL}>O'quvchi *</label>
            <input
              value={studentSearch}
              onChange={e => setStudentSearch(e.target.value)}
              placeholder="Ism yoki telefon bo'yicha qidiring..."
              className={INPUT}
            />
            {students?.length > 0 && studentSearch && (
              <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                {students.map((s: { id: string; firstName: string; lastName: string; phone: string | null }) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      form.setValue('studentId', s.id);
                      setStudentSearch(`${s.lastName} ${s.firstName}`);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium">{s.lastName} {s.firstName}</span>
                    {s.phone && <span className="text-gray-400 ml-2 text-xs">{s.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {form.formState.errors.studentId && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.studentId.message}</p>
            )}
          </div>

          {/* ── TO'LOV USULI ─────────────────────────────────────────── */}
          <div>
            <label className={LABEL}>To'lov usuli *</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => {
                const meta = METHOD_META[m];
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                      method === m
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span><meta.icon size={14} className="shrink-0" /></span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ARALASH: NAQD + KARTA ────────────────────────────────── */}
          {method === 'mixed' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Naqd qismi</label>
                <input
                  type="number"
                  min={0}
                  {...form.register('cashAmount', { valueAsNumber: true })}
                  className={INPUT}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={LABEL}>Karta qismi</label>
                <input
                  type="number"
                  min={0}
                  {...form.register('cardAmount', { valueAsNumber: true })}
                  className={INPUT}
                  placeholder="0"
                />
              </div>
              <div className="col-span-2 bg-emerald-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-emerald-700">Jami:</span>
                <span className="text-base font-bold text-emerald-700">
                  {(watchCash + watchCard).toLocaleString('uz-UZ')} so'm
                </span>
              </div>
            </div>
          )}

          {/* ── SUMMA ────────────────────────────────────────────────── */}
          {method !== 'mixed' && (
            <div>
              <label className={LABEL}>Summa (so'm) *</label>
              <input
                type="number"
                min={0}
                {...form.register('amount', { valueAsNumber: true })}
                className={`${INPUT} text-lg font-semibold`}
                placeholder="0"
              />
              {form.formState.errors.amount && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.amount.message}</p>
              )}
            </div>
          )}

          {/* ── NAQD KUPYURA ─────────────────────────────────────────── */}
          {method === 'cash' && (
            <CashDenomination
              value={denom}
              onChange={(d, c) => setDenom(prev => ({ ...prev, [d]: c }))}
              label="Kupyura bo'yicha hisoblash"
            />
          )}

          {/* ── TO'LOV OYI + IZOH ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>To'lov oyi</label>
              <input
                type="month"
                defaultValue={currentMonth}
                {...form.register('paymentMonth')}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Izoh</label>
              <input {...form.register('notes')} className={INPUT} placeholder="Ixtiyoriy" />
            </div>
          </div>

          {/* ── KVITANSIYA ───────────────────────────────────────────── */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...form.register('printReceipt')} defaultChecked className="w-4 h-4 accent-primary-600" />
            <span className="text-sm text-gray-700">Kvitansiya chop etish</span>
          </label>

          {createMut.error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">
              {String((createMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Xatolik yuz berdi')}
            </p>
          )}

          {/* ── TUGMALAR ─────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={createMut.isPending}
              className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
              {createMut.isPending ? 'Saqlanmoqda...' : 'Qabul qilish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

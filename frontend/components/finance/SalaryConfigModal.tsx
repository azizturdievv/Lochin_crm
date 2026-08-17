'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SalaryConfig } from '@/types/finance';

interface StaffOption { id: string; firstName: string; lastName: string; role: 'manager' | 'ustoz'; }

const fetchStaff = () =>
  api.get<{ data: StaffOption[] }>('/users', { params: { limit: 100 } }).then(r => r.data.data);
const fetchConfigs = () =>
  api.get<SalaryConfig[]>('/finance/salary/config').then(r => r.data);

interface Props { onClose: () => void }

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

export default function SalaryConfigModal({ onClose }: Props) {
  const qc = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [form, setForm] = useState({
    ratePercent: '0', kpiBonusPercent: '0', hourlyRate: '', salesBonusPercent: '0',
    paymentBonusPercent: '0', leadBonusAmount: '0',
  });

  const { data: staffList } = useQuery({ queryKey: ['salary-staff-options'], queryFn: fetchStaff });
  const { data: configs } = useQuery({ queryKey: ['salary-configs'], queryFn: fetchConfigs });

  const staff = staffList?.find(s => s.id === staffId);
  const isUstoz = staff?.role === 'ustoz';

  useEffect(() => {
    const existing = configs?.find(c => c.teacherId === staffId);
    setForm({
      ratePercent:         String(existing?.ratePercent ?? 0),
      kpiBonusPercent:     String(existing?.kpiBonusPercent ?? 0),
      hourlyRate:          existing?.hourlyRate ? String(existing.hourlyRate) : '',
      salesBonusPercent:   String(existing?.salesBonusPercent ?? 0),
      paymentBonusPercent: String(existing?.paymentBonusPercent ?? 0),
      leadBonusAmount:     String(existing?.leadBonusAmount ?? 0),
    });
  }, [staffId, configs]);

  const saveMut = useMutation({
    mutationFn: () => api.post('/finance/salary/config', {
      teacherId: staffId,
      ratePercent: Number(form.ratePercent) || 0,
      kpiBonusPercent: Number(form.kpiBonusPercent) || 0,
      ...(form.hourlyRate && { hourlyRate: Number(form.hourlyRate) }),
      salesBonusPercent: Number(form.salesBonusPercent) || 0,
      paymentBonusPercent: Number(form.paymentBonusPercent) || 0,
      leadBonusAmount: Number(form.leadBonusAmount) || 0,
      startedAt: new Date().toISOString().slice(0, 10),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-configs'] });
      onClose();
    },
  });

  const set = (key: keyof typeof form, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Ish haqi sozlash</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={LABEL}>Xodim</label>
            <select value={staffId} onChange={e => setStaffId(e.target.value)} className={INPUT + ' bg-white'}>
              <option value="">Tanlang</option>
              {staffList?.map(s => (
                <option key={s.id} value={s.id}>{s.lastName} {s.firstName} ({s.role === 'ustoz' ? 'Ustoz' : 'Manager'})</option>
              ))}
            </select>
          </div>

          {staffId && (
            <>
              {isUstoz ? (
                <div>
                  <label className={LABEL}>Tushum foizi (%) — odatda 15-18</label>
                  <input type="number" min={0} max={100} value={form.ratePercent}
                    onChange={e => set('ratePercent', e.target.value)} className={INPUT} />
                </div>
              ) : (
                <>
                  <div>
                    <label className={LABEL}>Soatlik stavka (so'm)</label>
                    <input type="number" min={0} value={form.hourlyRate}
                      onChange={e => set('hourlyRate', e.target.value)} className={INPUT} placeholder="0" />
                  </div>
                  <div>
                    <label className={LABEL}>Mini-market savdo bonusi (%)</label>
                    <input type="number" min={0} max={100} value={form.salesBonusPercent}
                      onChange={e => set('salesBonusPercent', e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>
                      Qabul qilgan to'lovlardan bonus (%)
                      <span className="ml-1 text-gray-400 font-normal">— 0 = o'chirilgan</span>
                    </label>
                    <input type="number" min={0} max={100} value={form.paymentBonusPercent}
                      onChange={e => set('paymentBonusPercent', e.target.value)} className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>
                      Har bir o'quvchiga aylangan lid uchun bonus (so'm)
                      <span className="ml-1 text-gray-400 font-normal">— 0 = o'chirilgan</span>
                    </label>
                    <input type="number" min={0} value={form.leadBonusAmount}
                      onChange={e => set('leadBonusAmount', e.target.value)} className={INPUT} placeholder="0" />
                  </div>
                </>
              )}

              <div>
                <label className={LABEL}>KPI bonus foizi (%)</label>
                <input type="number" min={0} max={100} value={form.kpiBonusPercent}
                  onChange={e => set('kpiBonusPercent', e.target.value)} className={INPUT} />
              </div>
            </>
          )}

          {saveMut.isError && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">Xatolik yuz berdi</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Bekor
            </button>
            <button
              onClick={() => saveMut.mutate()}
              disabled={!staffId || saveMut.isPending}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

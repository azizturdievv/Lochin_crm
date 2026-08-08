'use client';

import { Briefcase } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { SALARY_STATUS, fmtM } from '@/types/finance';
import type { SalaryRecord } from '@/types/finance';

interface Props { month: string }

export default function SalaryTab({ month }: Props) {
  const qc = useQueryClient();
  const [calculating, setCalculating] = useState(false);

  const { data: records, isLoading } = useQuery({
    queryKey: ['salary-records', month],
    queryFn:  () => api.get<SalaryRecord[]>('/finance/salary', { params: { month } }).then(r => r.data),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.patch(`/finance/salary/${id}/approve`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['salary-records', month] }),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => api.patch(`/finance/salary/${id}/paid`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['salary-records', month] }),
  });

  async function handleCalculate() {
    setCalculating(true);
    try {
      await api.post('/finance/salary/calculate', { month });
      qc.invalidateQueries({ queryKey: ['salary-records', month] });
    } finally {
      setCalculating(false);
    }
  }

  const totalPayable = (records ?? [])
    .filter(r => r.status !== 'paid')
    .reduce((s, r) => s + r.totalAmount, 0);

  const allApproved = (records ?? []).length > 0 && (records ?? []).every(r => r.status !== 'calculated');

  return (
    <div className="space-y-5">

      {/* Amallar satri */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Jami to'lanishi kerak:&nbsp;
            <span className="font-bold text-gray-900">{fmtM(totalPayable)} so'm</span>
          </span>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition"
        >
          {calculating
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : ''}
          Hisoblash ({month})
        </button>
      </div>

      {/* Jadval */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Xodim</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Asosiy</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">KPI bonus</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">O'rinbosar</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Chegirma</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Jami</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : !records?.length
                ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                        <div className="text-5xl mb-3"><Briefcase size={16} /></div>
                        <p className="font-medium">Ish haqi hisoblari yo'q</p>
                        <p className="text-sm mt-1">«Hisoblash» tugmasini bosing</p>
                      </td>
                    </tr>
                  )
                : records.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">
                          {r.teacher.lastName} {r.teacher.firstName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {r.lessonsCount} dars · {r.totalHours}h
                        </p>
                      </td>
                      <MoneyCell value={r.baseAmount} />
                      <MoneyCell value={r.kpiBonus} positive />
                      <MoneyCell value={r.subAmount} positive className="hidden sm:table-cell" />
                      <MoneyCell value={r.deduction} negative className="hidden md:table-cell" />
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-bold text-base text-gray-900">{fmtM(r.totalAmount)}</span>
                        <span className="text-gray-400 text-xs ml-1">so'm</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${SALARY_STATUS[r.status].cls}`}>
                          {SALARY_STATUS[r.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {r.status === 'calculated' && (
                            <button
                              onClick={() => approveMut.mutate(r.id)}
                              disabled={approveMut.isPending}
                              className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60"
                            >
                              Tasdiqlash
                            </button>
                          )}
                          {r.status === 'approved' && (
                            <button
                              onClick={() => paidMut.mutate(r.id)}
                              disabled={paidMut.isPending}
                              className="px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-60"
                            >
                              To'landi
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MoneyCell({ value, positive, negative, className = '' }: {
  value: number; positive?: boolean; negative?: boolean; className?: string;
}) {
  if (!value) return <td className={`px-4 py-3.5 text-right text-gray-300 text-sm ${className}`}>—</td>;
  return (
    <td className={`px-4 py-3.5 text-right text-sm ${positive ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-gray-700'} ${className}`}>
      {negative ? '-' : positive && value > 0 ? '+' : ''}{fmtM(value)}
    </td>
  );
}

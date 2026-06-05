'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Debtor } from '@/types/payments';

const fetchDebtors = (params: object) =>
  api.get<{ data: Debtor[]; total: number }>('/payments/debtors', { params }).then(r => r.data);

export default function DebtorsTab() {
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState<'all'|'critical'|'normal'>('all');
  const [month,    setMonth]    = useState(new Date().toISOString().slice(0,7));

  const params = { month, page, limit: 20, ...(filter === 'critical' && { critical: true }) };

  const { data, isLoading } = useQuery({
    queryKey: ['debtors', params],
    queryFn:  () => fetchDebtors(params),
    placeholderData: prev => prev,
  });

  const notifyMut = useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/notifications/send`, {
        userId:  studentId,
        type:    'payment',
        title:   'To\'lov eslatmasi',
        message: 'Hurmatli o\'quvchi, to\'lov muddati yaqinlashdi. Iltimos, o\'z vaqtida to\'lang.',
      }).then(r => r.data),
  });

  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  function sendReminder(studentId: string) {
    notifyMut.mutate(studentId, {
      onSuccess: () => setNotifiedIds(prev => new Set([...prev, studentId])),
    });
  }

  const debtors     = data?.data  ?? [];
  const total       = data?.total ?? 0;
  const totalPages  = Math.ceil(total / 20);
  const critical    = debtors.filter(d => d.isCritical).length;
  const totalDebt   = debtors.reduce((s, d) => s + d.debtAmount, 0);

  return (
    <div className="space-y-5">

      {/* ── XULOSA KARTALAR ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard icon="👥" label="Jami qarzdor"  value={`${total} ta`}  color="gray"   />
        <SummaryCard icon="🔴" label="Kritik"         value={`${critical} ta`} color="red"  />
        <SummaryCard icon="💸" label="Umumiy qarz"   value={`${(totalDebt/1_000_000).toFixed(1)}M so'm`} color="amber" />
      </div>

      {/* ── FILTRLAR ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {(['all','critical','normal'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-xl border font-medium transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {f === 'all' ? 'Barchasi' : f === 'critical' ? '🔴 Kritik' : '🟡 Oddiy'}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-auto">{total} ta natija</span>
      </div>

      {/* ── JADVAL ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">O'quvchi</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qarz</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Guruhlar</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Oxirgi to'lov</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : debtors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                    <div className="text-5xl mb-3">🎉</div>
                    <p className="font-medium text-gray-500">Qarzdorlar yo'q!</p>
                    <p className="text-sm mt-1">Bu oy barcha to'lovlar amalga oshirilgan</p>
                  </td>
                </tr>
              ) : debtors.map(d => (
                <tr key={d.studentId} className={`hover:bg-gray-50/60 transition-colors ${d.isCritical ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-medium text-gray-900">{d.studentName}</p>
                      {d.phone && <p className="text-xs text-gray-400">{d.phone}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`font-bold text-sm ${d.isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                      {d.debtAmount.toLocaleString('uz-UZ')} so'm
                    </span>
                    <p className="text-xs text-gray-400">{d.debtMonths} oy</p>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {d.groups.slice(0,2).map((g,i) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{g}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400 hidden md:table-cell">
                    {d.lastPaymentDate ? new Date(d.lastPaymentDate).toLocaleDateString('uz-UZ') : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      d.isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {d.isCritical ? '🔴 Kritik' : '🟡 Oddiy'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => sendReminder(d.studentId)}
                      disabled={notifiedIds.has(d.studentId) || notifyMut.isPending}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        notifiedIds.has(d.studentId)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      {notifiedIds.has(d.studentId) ? '✓ Yuborildi' : '📱 Eslatma'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">{(page-1)*20+1}–{Math.min(page*20, total)} / {total}</p>
            <div className="flex gap-1">
              <PBtn disabled={page===1}         onClick={() => setPage(p=>p-1)} label="‹" />
              <PBtn disabled={page===totalPages} onClick={() => setPage(p=>p+1)} label="›" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon:string; label:string; value:string; color:string }) {
  const cls = color==='red' ? 'bg-red-50 text-red-700' : color==='amber' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-700';
  return (
    <div className={`${cls} rounded-xl p-4`}>
      <div className="text-xl mb-1">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function PBtn({ onClick, disabled, label }: { onClick:()=>void; disabled:boolean; label:string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors">
      {label}
    </button>
  );
}

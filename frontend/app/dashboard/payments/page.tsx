'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import KpiCard from '@/components/ui/KpiCard';
import PaymentModal from '@/components/payments/PaymentModal';
import ReceiptModal from '@/components/payments/ReceiptModal';
import InstallmentModal from '@/components/payments/InstallmentModal';
import SessionWidget from '@/components/payments/SessionWidget';
import DebtorsTab from '@/components/payments/DebtorsTab';
import type { Payment, PaymentsResponse } from '@/types/payments';
import { METHOD_META, STATUS_META } from '@/types/payments';

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchPayments = (p: object) =>
  api.get<PaymentsResponse>('/payments', { params: p }).then(r => r.data);

const fetchReport = () =>
  api.get('/payments/report').then(r => r.data);

const LIMIT = 20;
type ActiveTab = 'list' | 'debtors';

// ─── EXPORT ───────────────────────────────────────────────────────────────────
async function downloadExport(type: 'excel' | 'pdf', month: string) {
  const ext  = type === 'excel' ? 'xlsx' : 'pdf';
  const mime = type === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf';

  const res = await api.get(`/payments/export/${type}`, {
    params:       { month },
    responseType: 'blob',
  });

  const url = URL.createObjectURL(new Blob([res.data], { type: mime }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `tolovlar-${month}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [activeTab,  setActiveTab]  = useState<ActiveTab>('list');
  const [payModal,   setPayModal]   = useState(false);
  const [instModal,  setInstModal]  = useState(false);
  const [receipt,    setReceipt]    = useState<Payment | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  // Filtrlar
  const [search,   setSearch]   = useState('');
  const [method,   setMethod]   = useState('');
  const [status,   setStatus]   = useState('');
  const [month,    setMonth]    = useState(new Date().toISOString().slice(0,7));
  const [page,     setPage]     = useState(1);
  const [sortBy,   setSortBy]   = useState('createdAt');
  const [sortOrd,  setSortOrd]  = useState<'ASC'|'DESC'>('DESC');

  const dSearch = useDebounce(search, 400);

  const queryParams = {
    ...(dSearch && { studentId: dSearch }),
    ...(method  && { method }),
    ...(status  && { status }),
    ...(month   && { paymentMonth: month }),
    page, limit: LIMIT, sortBy, sortOrder: sortOrd,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['payments', queryParams],
    queryFn:  () => fetchPayments(queryParams),
    placeholderData: prev => prev,
  });

  const { data: report } = useQuery({
    queryKey: ['payment-report', month],
    queryFn:  fetchReport,
  });

  const payments   = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const handleSort = useCallback((field: string) => {
    if (sortBy === field) setSortOrd(p => p === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrd('DESC'); }
    setPage(1);
  }, [sortBy]);

  async function handleExport(type: 'excel'|'pdf') {
    setExportBusy(true);
    try { await downloadExport(type, month); }
    finally { setExportBusy(false); }
  }

  return (
    <div className="space-y-5">

      {/* ── SARLAVHA ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">To'lovlar</h2>
          <p className="text-gray-500 text-sm mt-0.5">{month} oyi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => handleExport('excel')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            📊 Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            📄 PDF
          </button>
          <button onClick={() => setInstModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-emerald-300 text-emerald-700 rounded-xl hover:bg-emerald-50 transition">
            📅 Muddatli
          </button>
          <button onClick={() => setPayModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition shadow-sm">
            + To'lov qabul
          </button>
        </div>
      </div>

      {/* ── KPI + SMENA ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Oylik daromad" value={`${((report?.month ?? 0)/1_000_000).toFixed(1)}M so'm`} icon="💰" color="emerald" />
        <KpiCard title="Bugungi"       value={`${((report?.today ?? 0)/1_000).toFixed(0)}K so'm`}    icon="📅" color="blue"    />
        <KpiCard title="To'lovlar soni" value={`${report?.count ?? 0} ta`}                            icon="📝" color="purple"  />
        <KpiCard title="O'rtacha"      value={`${((report?.avg ?? 0)/1_000).toFixed(0)}K so'm`}      icon="📊" color="amber"   />
      </div>

      {/* ── SMENA WIDGET ─────────────────────────────────────────────── */}
      <SessionWidget />

      {/* ── TABLAR ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        {(['list','debtors'] as ActiveTab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'list' ? '📋 To\'lovlar' : '⚠️ Qarzdorlar'}
          </button>
        ))}
      </div>

      {activeTab === 'debtors' ? (
        <DebtorsTab />
      ) : (
        <>
          {/* ── FILTRLAR ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-3">
              <input type="month" value={month}
                onChange={e => { setMonth(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />

              <select value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-32">
                <option value="">Barcha usul</option>
                {(Object.keys(METHOD_META) as (keyof typeof METHOD_META)[]).map(m => (
                  <option key={m} value={m}>{METHOD_META[m].icon} {METHOD_META[m].label}</option>
                ))}
              </select>

              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-32">
                <option value="">Barcha holat</option>
                {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>

              {(method || status) && (
                <button onClick={() => { setMethod(''); setStatus(''); setPage(1); }}
                  className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  ✕ Tozalash
                </button>
              )}

              <span className="ml-auto text-sm text-gray-400 self-center">{total} ta</span>
            </div>
          </div>

          {/* ── TO'LOVLAR JADVALI ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('student')}>O'quvchi</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700"
                      onClick={() => handleSort('amount')}>
                      Summa {sortBy==='amount' ? (sortOrd==='ASC'?'↑':'↓') : ''}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Usul</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Oy</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 hidden lg:table-cell"
                      onClick={() => handleSort('createdAt')}>
                      Sana {sortBy==='createdAt' ? (sortOrd==='ASC'?'↑':'↓') : ''}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading
                    ? Array.from({length:8}).map((_,i) => (
                        <tr key={i}>
                          {Array.from({length:7}).map((__,j) => (
                            <td key={j} className="px-4 py-3.5">
                              <div className="h-4 bg-gray-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : payments.length === 0
                    ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                            <div className="text-5xl mb-3">💳</div>
                            <p className="font-medium text-gray-500">To'lovlar topilmadi</p>
                            <p className="text-sm mt-1">Filtrlarni o'zgartiring</p>
                          </td>
                        </tr>
                      )
                    : payments.map(p => <PaymentRow key={p.id} payment={p} onReceipt={() => setReceipt(p)} />)
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">{(page-1)*LIMIT+1}–{Math.min(page*LIMIT,total)} / {total}</p>
                <div className="flex gap-1">
                  {[
                    { label:'«', fn:() => setPage(1),           dis: page===1 },
                    { label:'‹', fn:() => setPage(p=>p-1),      dis: page===1 },
                    { label:'›', fn:() => setPage(p=>p+1),      dis: page===totalPages },
                    { label:'»', fn:() => setPage(totalPages),   dis: page===totalPages },
                  ].map(b => (
                    <button key={b.label} onClick={b.fn} disabled={b.dis}
                      className="w-8 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODALAR ──────────────────────────────────────────────────── */}
      <PaymentModal
        open={payModal}
        onClose={() => setPayModal(false)}
        onSuccess={(id) => {
          // Keyinchalik receipt ko'rsatish mumkin
        }}
      />

      <InstallmentModal open={instModal} onClose={() => setInstModal(false)} />

      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}

// ─── TO'LOV SATRI ─────────────────────────────────────────────────────────────
function PaymentRow({ payment, onReceipt }: { payment: Payment; onReceipt: () => void }) {
  const meta   = METHOD_META[payment.method];
  const status = STATUS_META[payment.status];

  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      <td className="px-5 py-3.5">
        <p className="font-medium text-gray-900">
          {payment.student.lastName} {payment.student.firstName}
        </p>
        {payment.student.phone && (
          <p className="text-xs text-gray-400">{payment.student.phone}</p>
        )}
      </td>

      <td className="px-4 py-3.5 text-right">
        <span className="font-bold text-base text-gray-900">
          {payment.amount.toLocaleString('uz-UZ')}
        </span>
        <span className="text-gray-400 text-xs ml-1">so'm</span>
        {payment.method === 'mixed' && (
          <p className="text-xs text-gray-400">
            N: {(payment.cashAmount ?? 0).toLocaleString('uz-UZ')} /
            K: {(payment.cardAmount ?? 0).toLocaleString('uz-UZ')}
          </p>
        )}
      </td>

      <td className="px-4 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span>{meta.icon}</span>
          <span className="text-gray-700">{meta.label}</span>
        </span>
      </td>

      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-gray-500 text-sm">{payment.paymentMonth ?? '—'}</span>
      </td>

      <td className="px-4 py-3.5">
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </td>

      <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-400">
        {new Date(payment.createdAt).toLocaleString('uz-UZ', { dateStyle:'short', timeStyle:'short' })}
      </td>

      <td className="px-4 py-3.5 text-right">
        <button
          onClick={onReceipt}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 text-sm"
          title="Kvitansiya"
        >
          🧾
        </button>
      </td>
    </tr>
  );
}

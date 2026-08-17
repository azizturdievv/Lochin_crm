'use client';

import { Banknote, BarChart3, Calendar, ChevronDown, ChevronUp, CreditCard, FileText, PlusCircle, Receipt, Search } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime } from '@/lib/date';
import KpiCard from '@/components/ui/KpiCard';
import PaymentModal from '@/components/payments/PaymentModal';
import ReceiptModal from '@/components/payments/ReceiptModal';
import InstallmentModal, { InstallmentCard } from '@/components/payments/InstallmentModal';
import SessionWidget, { fetchActiveSession } from '@/components/payments/SessionWidget';
import DebtorsTab from '@/components/payments/DebtorsTab';
import type { Payment, PaymentsResponse, InstallmentPlan } from '@/types/payments';
import { METHOD_META, METHOD_CHIP_CLS, STATUS_META } from '@/types/payments';

// ─── API ──────────────────────────────────────────────────────────────────────
const fetchPayments = (p: object) =>
  api.get<PaymentsResponse>('/payments', { params: p }).then(r => r.data);

interface PaymentReport {
  month:       string;
  grandTotal:  number;
  byMethod:    Record<string, { total: number; count: number }>;
  debtorCount: number;
}
const fetchReport = (month: string) =>
  api.get<PaymentReport>('/payments/report', { params: { month } }).then(r => r.data);

interface StudentOption { id: string; firstName: string; lastName: string; }
const fetchStudentOptions = (q: string) =>
  api.get<{ data: StudentOption[] }>('/students', { params: { search: q, limit: 8, isActive: true } }).then(r => r.data.data);

interface StaffOption { id: string; firstName: string; lastName: string; }
const fetchStaffOptions = () =>
  api.get<{ data: StaffOption[] }>('/users', { params: { limit: 100 } }).then(r => r.data.data);

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];
type ActiveTab = 'list' | 'debtors' | 'installments';

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
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [activeTab,  setActiveTab]  = useState<ActiveTab>(
    initialTab === 'debtors' || initialTab === 'installments' ? initialTab : 'list'
  );
  const [payModal,   setPayModal]   = useState(false);
  const [instModal,  setInstModal]  = useState(false);
  const [receipt,    setReceipt]    = useState<Payment | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  // Filtrlar
  const [studentQuery,     setStudentQuery]     = useState('');
  const [studentId,        setStudentId]        = useState('');
  const [studentName,      setStudentName]      = useState('');
  const [method,   setMethod]   = useState('');
  const [status,   setStatus]   = useState('');
  const [receivedById, setReceivedById] = useState('');
  const [month,    setMonth]    = useState(new Date().toISOString().slice(0,7));
  const [page,     setPage]     = useState(1);
  const [limit,    setLimit]    = useState(20);
  const [sortBy,   setSortBy]   = useState('createdAt');
  const [sortOrd,  setSortOrd]  = useState<'ASC'|'DESC'>('DESC');

  const dStudentQuery = useDebounce(studentQuery, 350);

  const { data: studentOptions } = useQuery({
    queryKey: ['payments-student-search', dStudentQuery],
    queryFn:  () => fetchStudentOptions(dStudentQuery),
    enabled:  dStudentQuery.length >= 2 && !studentId,
  });

  const { data: staffOptions } = useQuery({
    queryKey: ['payments-staff-options'],
    queryFn:  fetchStaffOptions,
  });

  const queryParams = {
    ...(studentId && { studentId }),
    ...(method  && { method }),
    ...(status  && { status }),
    ...(month   && { paymentMonth: month }),
    ...(receivedById && { receivedById }),
    page, limit, sortBy, sortOrder: sortOrd,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['payments', queryParams],
    queryFn:  () => fetchPayments(queryParams),
    placeholderData: prev => prev,
  });

  const { data: report } = useQuery({
    queryKey: ['payment-report', month],
    queryFn:  () => fetchReport(month),
  });

  // SessionWidget bilan bir xil query key — smena ochiq/yopiqligini ikkala
  // joyda ham qayta so'ramasdan bir xil keshdan oladi
  const { data: activeSession } = useQuery({
    queryKey: ['active-session'],
    queryFn:  fetchActiveSession,
    refetchInterval: 60_000,
  });

  const paymentCount = report ? Object.values(report.byMethod).reduce((s, m) => s + m.count, 0) : 0;
  const avgAmount    = paymentCount > 0 ? (report!.grandTotal / paymentCount) : 0;

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
            Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            PDF
          </button>
          <button onClick={() => setPayModal(true)} disabled={!activeSession}
            title={activeSession ? undefined : 'To\'lov qabul qilishdan oldin smenani oching'}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600">
            + To'lov qabul
          </button>
        </div>
      </div>

      {/* ── KPI + SMENA ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Oylik daromad"  value={`${((report?.grandTotal ?? 0)/1_000_000).toFixed(1)}M so'm`} icon={Banknote}  color="emerald" href="/dashboard/finance" />
        <KpiCard title="Qarzdorlar"     value={`${report?.debtorCount ?? 0} ta`}                            icon={Calendar}  color="red"     onClick={() => setActiveTab('debtors')} />
        <KpiCard title="To'lovlar soni" value={`${paymentCount} ta`}                                        icon={FileText}  color="purple"  onClick={() => setActiveTab('list')} />
        <KpiCard title="O'rtacha"       value={`${(avgAmount/1_000).toFixed(0)}K so'm`}                     icon={BarChart3} color="amber"   onClick={() => setActiveTab('list')} />
      </div>

      {/* ── SMENA WIDGET ─────────────────────────────────────────────── */}
      <SessionWidget />

      {/* ── TABLAR ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        {(['list','debtors','installments'] as ActiveTab[]).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === t
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'list' ? 'To\'lovlar' : t === 'debtors' ? 'Qarzdorlar' : 'Muddatli'}
          </button>
        ))}
      </div>

      {activeTab === 'debtors' ? (
        <DebtorsTab />
      ) : activeTab === 'installments' ? (
        <InstallmentsTab onCreate={() => setInstModal(true)} />
      ) : (
        <>
          {/* ── FILTRLAR ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap gap-3 items-start">
              {/* O'quvchi qidiruv */}
              <div className="relative min-w-56">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Search size={15} /></span>
                <input
                  value={studentName || studentQuery}
                  onChange={e => { setStudentQuery(e.target.value); setStudentId(''); setStudentName(''); setPage(1); }}
                  placeholder="O'quvchi bo'yicha qidirish..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {studentOptions && studentOptions.length > 0 && !studentId && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                    {studentOptions.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => { setStudentId(s.id); setStudentName(`${s.lastName} ${s.firstName}`); setStudentQuery(''); setPage(1); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                        {s.lastName} {s.firstName}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input type="month" value={month}
                onChange={e => { setMonth(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />

              <select value={method} onChange={e => { setMethod(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-32">
                <option value="">Barcha usul</option>
                {(Object.keys(METHOD_META) as (keyof typeof METHOD_META)[]).map(m => (
                  <option key={m} value={m}>{METHOD_META[m].label}</option>
                ))}
              </select>

              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-32">
                <option value="">Barcha holat</option>
                {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>

              <select value={receivedById} onChange={e => { setReceivedById(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white min-w-36">
                <option value="">Barcha kassir</option>
                {staffOptions?.map(s => (
                  <option key={s.id} value={s.id}>{s.lastName} {s.firstName}</option>
                ))}
              </select>

              {(studentId || method || status || receivedById) && (
                <button onClick={() => { setStudentId(''); setStudentName(''); setStudentQuery(''); setMethod(''); setStatus(''); setReceivedById(''); setPage(1); }}
                  className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
                  Tozalash
                </button>
              )}

              <div className="ml-auto flex items-center gap-2 self-center">
                <label className="text-xs text-gray-400">Qatorlar:</label>
                <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                  {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-sm text-gray-400">{total} ta</span>
              </div>
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
                      Summa {sortBy==='amount' ? (sortOrd==='ASC'? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />) : null}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Usul</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Oy</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Kassir</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Holat</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 hidden lg:table-cell"
                      onClick={() => handleSort('createdAt')}>
                      Sana {sortBy==='createdAt' ? (sortOrd==='ASC'? <ChevronUp size={12} className="inline" /> : <ChevronDown size={12} className="inline" />) : null}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading
                    ? Array.from({length:8}).map((_,i) => (
                        <tr key={i}>
                          {Array.from({length:8}).map((__,j) => (
                            <td key={j} className="px-4 py-3.5">
                              <div className="h-4 bg-gray-100 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : payments.length === 0
                    ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-16 text-center text-gray-400">
                            <div className="text-5xl mb-3"><CreditCard size={16} /></div>
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
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                <Pagination page={page} totalPages={totalPages} total={total} rowsPerPage={limit} onPage={setPage} />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MODALAR ──────────────────────────────────────────────────── */}
      <PaymentModal
        open={payModal}
        onClose={() => setPayModal(false)}
        cashSessionId={activeSession?.id}
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
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${METHOD_CHIP_CLS[payment.method]}`}>
          <meta.icon size={12} className="shrink-0" /> {meta.label}
        </span>
      </td>

      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-gray-500 text-sm">{payment.paymentMonth ?? '—'}</span>
      </td>

      <td className="px-4 py-3.5 hidden md:table-cell">
        <span className="text-gray-500 text-sm">
          {payment.receivedBy ? `${payment.receivedBy.lastName} ${payment.receivedBy.firstName}` : '—'}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${status.cls}`}>
          {status.label}
        </span>
      </td>

      <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-400">
        {formatDateTime(payment.createdAt)}
      </td>

      <td className="px-4 py-3.5 text-right">
        <button
          onClick={onReceipt}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 text-sm"
          title="Kvitansiya"
        ><Receipt size={16} /></button>
      </td>
    </tr>
  );
}

// ─── MUDDATLI TO'LOVLAR TABI ──────────────────────────────────────────────────
interface InstallmentsResponse { data: InstallmentPlan[]; total: number; page: number; limit: number; totalPages: number; }
const fetchInstallments = (page: number) =>
  api.get<InstallmentsResponse>('/payments/installments', { params: { page, limit: 12 } }).then(r => r.data);

function InstallmentsTab({ onCreate }: { onCreate: () => void }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['installments', page],
    queryFn:  () => fetchInstallments(page),
    placeholderData: prev => prev,
  });

  const plans = data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{data?.total ?? 0} ta reja</p>
        <button onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm">
          <PlusCircle size={16} /> Yangi muddatli to'lov
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 h-48 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-16 text-center">
          <FileText size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">Muddatli to'lov rejalari yo'q</p>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Yangi muddatli to'lov rejasi yaratish uchun yuqoridagi tugmani bosing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className="space-y-2">
              {plan.student && (
                <p className="text-sm font-medium text-gray-900 px-1">
                  {plan.student.lastName} {plan.student.firstName}
                </p>
              )}
              <InstallmentCard plan={plan} />
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <Pagination page={page} totalPages={data.totalPages} total={data.total} rowsPerPage={12} onPage={setPage} />
      )}
    </div>
  );
}

function Pagination({ page, totalPages, total, rowsPerPage, onPage }: {
  page: number; totalPages: number; total: number; rowsPerPage: number; onPage: Dispatch<SetStateAction<number>>;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-500">{(page-1)*rowsPerPage+1}–{Math.min(page*rowsPerPage,total)} / {total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(p => p - 1)} disabled={page === 1}
          className="px-3 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Oldingi
        </button>
        {getPageNumbers(page, totalPages).map((p, i) =>
          p === '...' ? (
            <span key={`e${i}`} className="px-1.5 text-gray-400 text-xs">…</span>
          ) : (
            <button key={p} onClick={() => onPage(Number(p))}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}>
              {p}
            </button>
          ),
        )}
        <button onClick={() => onPage(p => p + 1)} disabled={page === totalPages}
          className="px-3 h-8 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Keyingi
        </button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [1];
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

'use client';

import { BarChart3, Briefcase, ClipboardList, Lock, Send, Trophy, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { toast } from '@/store/toast.store';
import KpiGrid from '@/components/finance/KpiGrid';
import PnlTable from '@/components/finance/PnlTable';
import SalaryTab from '@/components/finance/SalaryTab';
import ExpensesTab from '@/components/finance/ExpensesTab';
import BonusTab from '@/components/finance/BonusTab';
import type { KpiData } from '@/types/finance';

type ActiveTab = 'dashboard' | 'pnl' | 'salary' | 'expenses' | 'bonus';

const TABS: { id: ActiveTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard',  icon: BarChart3 },
  { id: 'pnl',       label: 'P&L',        icon: ClipboardList },
  { id: 'salary',    label: 'Ish haqi',   icon: Briefcase },
  { id: 'expenses',  label: 'Xarajatlar', icon: Upload },
  { id: 'bonus',     label: 'Mukofot',    icon: Trophy },
];

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function downloadBlob(url: string, params: object, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' });
  const href = URL.createObjectURL(new Blob([res.data]));
  const a    = document.createElement('a');
  a.href = href; a.download = filename; a.click();
  URL.revokeObjectURL(href);
}

export default function FinancePage() {
  const user = useAuthStore(s => s.user);
  const role = user?.role ?? '';

  const [tab,   setTab]   = useState<ActiveTab>('dashboard');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [exportBusy,    setExportBusy]    = useState(false);
  const [telegramChat,  setTelegramChat]  = useState('');
  const [showTgModal,   setShowTgModal]   = useState(false);

  const year = month.slice(0, 4);

  // ── RBAC ────────────────────────────────────────────────────────────────────
  if (role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <div className="text-5xl mb-3"><Lock size={16} /></div>
        <p className="font-medium text-gray-600">Bu sahifa faqat Super Admin uchun</p>
        <p className="text-sm mt-1">Sizga bu bo'limga kirish ruxsati yo'q</p>
      </div>
    );
  }

  // KPI so'rovlari
  const { data: kpi,     isLoading: kpiLoad }  = useQuery({
    queryKey: ['finance-kpi', month],
    queryFn:  () => api.get<KpiData>('/finance/kpi', { params: { month } }).then(r => r.data),
  });
  const { data: prevKpi } = useQuery({
    queryKey: ['finance-kpi', prevMonth(month)],
    queryFn:  () => api.get<KpiData>('/finance/kpi', { params: { month: prevMonth(month) } }).then(r => r.data),
  });

  // Export funksiyalari
  async function handleExport(type: 'pnl-excel' | 'salary-excel' | 'pdf') {
    setExportBusy(true);
    try {
      const ext = type === 'pdf' ? 'pdf' : 'xlsx';
      await downloadBlob(`/finance/export/${type}`, { month }, `moliya-${type}-${month}.${ext}`);
    } finally {
      setExportBusy(false);
    }
  }

  async function handleTelegram() {
    if (!telegramChat.trim()) return;
    try {
      await api.post('/finance/export/telegram', { month, chatId: telegramChat.trim() });
      setShowTgModal(false);
      toast.success('Hisobot Telegram\'ga yuborildi');
    } catch {
      toast.error('Telegram yuborishda xatolik', handleTelegram);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── SARLAVHA ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Moliya</h2>
          <p className="text-gray-400 text-sm mt-0.5">Faqat Super Admin ko'radi</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Oy tanlash */}
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Export tugmalari */}
          <button onClick={() => handleExport('pnl-excel')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            Excel
          </button>
          <button onClick={() => handleExport('salary-excel')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            Maosh Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={exportBusy}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">
            PDF
          </button>
          <button onClick={() => setShowTgModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition">
            <Send size={14} /> Telegram
          </button>
        </div>
      </div>

      {/* ── KPI KARTALAR ─────────────────────────────────────────────── */}
      <KpiGrid
        data={kpi} loading={kpiLoad} prevData={prevKpi}
        onPnlClick={() => setTab('pnl')}
        onExpensesClick={() => setTab('expenses')}
      />

      {/* ── TABLAR ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors -mb-px ${
              tab === t.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <span><t.icon size={14} className="shrink-0" /></span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB KONTENTI ─────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <DashboardTab kpi={kpi} loading={kpiLoad} month={month} year={year} />
      )}
      {tab === 'pnl'       && <PnlTable month={month} year={year} />}
      {tab === 'salary'    && <SalaryTab month={month} />}
      {tab === 'expenses'  && <ExpensesTab month={month} />}
      {tab === 'bonus'     && <BonusTab month={month} />}

      {/* ── TELEGRAM MODAL ───────────────────────────────────────────── */}
      {showTgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4"><Send size={14} /> Telegramga yuborish</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Telegram Chat ID</label>
              <input
                value={telegramChat}
                onChange={e => setTelegramChat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="-100xxxxxxxxxx yoki @username"
              />
              <p className="text-xs text-gray-400 mt-1">{month} oy hisoboti yuboriladi</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowTgModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Bekor
              </button>
              <button onClick={handleTelegram} disabled={!telegramChat.trim()}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-60 transition">
                Yuborish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD TAB ────────────────────────────────────────────────────────────
function DashboardTab({ kpi, loading, month, year }: {
  kpi?: KpiData; loading: boolean; month: string; year: string;
}) {
  return (
    <div className="space-y-5">

      {/* Daromad/Xarajat/Foyda progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">{month} — Xulosa</h3>
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : kpi ? (
          <div className="space-y-4">
            <ProgressRow
              label="Daromad"
              value={kpi.totalIncome}
              max={kpi.totalIncome}
              color="bg-emerald-500"
            />
            <ProgressRow
              label="Xarajat"
              value={kpi.totalExpenses}
              max={kpi.totalIncome}
              color="bg-red-400"
            />
            <ProgressRow
              label="Sof foyda"
              value={Math.max(0, kpi.netProfit)}
              max={kpi.totalIncome}
              color="bg-blue-500"
            />
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">Marja:</span>
              <span className={`font-bold text-lg ${kpi.marginPercent >= 25 ? 'text-emerald-600' : kpi.marginPercent >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                {kpi.marginPercent}%
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* P&L tahlil + fan daromadi */}
      <PnlTable month={month} year={year} />
    </div>
  );
}

function ProgressRow({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">
          {value.toLocaleString('uz-UZ')} so'm
          <span className="text-gray-400 text-xs ml-2">({pct}%)</span>
        </span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

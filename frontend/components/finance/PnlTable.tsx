'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer,
} from 'recharts';
import api from '@/lib/api';
import { EXPENSE_CATEGORIES, MONTHS_UZ, fmtM } from '@/types/finance';
import type { MonthlyPnl, AnnualPnl, SubjectRevenue } from '@/types/finance';

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#ec4899'];

interface Props {
  month: string;
  year:  string;
}

export default function PnlTable({ month, year }: Props) {
  const [mode, setMode] = useState<'monthly' | 'annual'>('monthly');

  const { data: monthly, isLoading: mLoad } = useQuery({
    queryKey: ['pnl-monthly', month],
    queryFn:  () => api.get<MonthlyPnl>('/finance/pnl', { params: { month } }).then(r => r.data),
    enabled:  mode === 'monthly',
  });

  const { data: annual, isLoading: aLoad } = useQuery({
    queryKey: ['pnl-annual', year],
    queryFn:  () => api.get<AnnualPnl>('/finance/pnl', { params: { year } }).then(r => r.data),
    enabled:  mode === 'annual',
  });

  const { data: subRev } = useQuery({
    queryKey: ['subject-revenue', year],
    queryFn:  () => api.get<SubjectRevenue>('/finance/subject-revenue', { params: { year } }).then(r => r.data),
  });

  const isLoading = mode === 'monthly' ? mLoad : aLoad;

  // Yillik trend uchun ma'lumot
  const trendData = (annual?.months ?? []).map((m, i) => ({
    name:      MONTHS_UZ[i]?.slice(0, 3) ?? m.month,
    daromad:   m.totalIncome,
    xarajat:   m.totalExpenses,
    foyda:     m.netProfit,
  }));

  // Fan pie chart
  const pieData = (subRev?.annual ?? []).map((s, i) => ({
    name:  s.subjectName,
    value: s.total,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-6">

      {/* Rejim tanlash */}
      <div className="flex items-center gap-2">
        {(['monthly', 'annual'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-medium rounded-xl border transition-all ${
              mode === m
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {m === 'monthly' ? `📅 ${month}` : `📆 ${year} yil`}
          </button>
        ))}
      </div>

      {/* ── P&L JADVALI ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">
            {mode === 'monthly' ? `${month} — P&L jadvali` : `${year} — Yillik P&L`}
          </h3>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ko'rsatkich</th>
                {mode === 'annual'
                  ? MONTHS_UZ.map(m => <th key={m} className="text-right px-2 py-3 text-xs font-medium text-gray-400">{m.slice(0,3)}</th>)
                  : <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Summa</th>
                }
                {mode === 'annual' && <th className="text-right px-4 py-3 text-xs font-medium text-gray-700 uppercase tracking-wide">Yillik</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {mode === 'monthly' && monthly ? (
                <>
                  <PnlRow label="💰 Jami daromad" value={monthly.totalIncome} bold positive />
                  <PnlRow label="  Ish haqi (xarajat)" value={monthly.expensesBreakdown.salaries} indent />
                  <PnlRow label="  Operatsion xarajat" value={monthly.expensesBreakdown.operational} indent />
                  <PnlRow label="📤 Jami xarajat" value={monthly.totalExpenses} bold />
                  <PnlRow label="📈 Sof foyda" value={monthly.netProfit} bold positive={monthly.netProfit >= 0} className={monthly.netProfit >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'} />
                  <PnlRow label="% Marja" value={monthly.marginPercent} bold suffix="%" />
                </>
              ) : mode === 'annual' && annual ? (
                <>
                  <AnnualRow label="💰 Daromad" months={annual.months.map(m => m.totalIncome)} total={annual.annualTotal.income} positive />
                  <AnnualRow label="📤 Xarajat" months={annual.months.map(m => m.totalExpenses)} total={annual.annualTotal.expenses} />
                  <AnnualRow label="📈 Foyda" months={annual.months.map(m => m.netProfit)} total={annual.annualTotal.netProfit} bold positive={annual.annualTotal.netProfit >= 0} className="bg-emerald-50/30" />
                </>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 2 USTUNLI GRAFIKLAR ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LineChart: 12 oy trend */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">📈 {year} — Oylik trend</h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => fmtM(Number(v))} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, name) => [`${fmtM(Number(v))} so'm`, name === 'daromad' ? 'Daromad' : name === 'xarajat' ? 'Xarajat' : 'Foyda']} />
                <Legend formatter={v => v === 'daromad' ? 'Daromad' : v === 'xarajat' ? 'Xarajat' : 'Foyda'} />
                <Line type="monotone" dataKey="daromad" stroke="#10b981" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="xarajat" stroke="#f87171" strokeWidth={2}   dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="foyda"   stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Ma'lumot yuklanmoqda...
            </div>
          )}
        </div>

        {/* PieChart: fan bo'yicha daromad */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">🎓 Fan bo'yicha daromad ({year})</h4>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="40%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${fmtM(Number(v))} so'm`]} />
                <Legend
                  layout="vertical" align="right" verticalAlign="middle" iconSize={10}
                  formatter={v => <span className="text-xs text-gray-600">{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm animate-pulse bg-gray-50 rounded-xl" />
          )}
        </div>
      </div>

      {/* ── TO'LOV USULI VA KATEGORIYA BREAKDOWN ─────────────────────── */}
      {mode === 'monthly' && monthly && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* To'lov usuli */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">💳 To'lov usuli</h4>
            <div className="space-y-2">
              {monthly.income.byMethod.map(m => (
                <div key={m.method} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 capitalize">{m.method}</span>
                  <div className="text-right">
                    <span className="font-semibold">{fmtM(m.total)} so'm</span>
                    <span className="text-gray-400 text-xs ml-2">({m.count} ta)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Xarajat kategoriya */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">📤 Xarajat kategoriya</h4>
            <div className="space-y-2">
              {monthly.expenses.byCategory.map(c => {
                const meta = EXPENSE_CATEGORIES[c.category as keyof typeof EXPENSE_CATEGORIES] ?? { label: c.category, icon: '📌', color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={c.category} className="flex items-center justify-between text-sm">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="font-semibold text-gray-900">{fmtM(c.total)} so'm</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── YORDAMCHI KOMPONENTLAR ───────────────────────────────────────────────────
function PnlRow({ label, value, bold, positive, indent, suffix = '', className = '' }: {
  label: string; value: number; bold?: boolean; positive?: boolean;
  indent?: boolean; suffix?: string; className?: string;
}) {
  const txt = suffix ? `${value}${suffix}` : `${fmtM(value)} so'm`;
  const colorCls = positive === true ? 'text-emerald-700' : positive === false ? 'text-red-600' : 'text-gray-700';
  return (
    <tr className={className}>
      <td className={`px-6 py-3 ${indent ? 'pl-10 text-gray-400 text-xs' : ''} ${bold ? 'font-semibold' : ''}`}>
        {label}
      </td>
      <td className={`px-6 py-3 text-right font-${bold ? 'bold' : 'medium'} ${colorCls}`}>{txt}</td>
    </tr>
  );
}

function AnnualRow({ label, months, total, bold, positive, className = '' }: {
  label: string; months: number[]; total: number; bold?: boolean;
  positive?: boolean; className?: string;
}) {
  const colorCls = positive === true ? 'text-emerald-700' : positive === false ? 'text-red-600' : 'text-gray-700';
  return (
    <tr className={className}>
      <td className={`px-6 py-2.5 text-sm ${bold ? 'font-semibold' : 'text-gray-600'}`}>{label}</td>
      {months.map((v, i) => (
        <td key={i} className={`px-2 py-2.5 text-right text-xs ${v < 0 ? 'text-red-500' : 'text-gray-600'}`}>
          {fmtM(v)}
        </td>
      ))}
      <td className={`px-4 py-2.5 text-right font-bold text-sm ${colorCls}`}>{fmtM(total)} so'm</td>
    </tr>
  );
}

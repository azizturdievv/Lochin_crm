'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { EXPENSE_CATEGORIES, fmtM } from '@/types/finance';
import type { Expense, ExpenseCategory } from '@/types/finance';

interface Props { month: string }

const CATS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];
const INPUT = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white';

export default function ExpensesTab({ month }: Props) {
  const qc = useQueryClient();

  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<Expense | null>(null);
  const [title,    setTitle]          = useState('');
  const [category, setCategory]       = useState<ExpenseCategory>('other');
  const [amount,   setAmount]         = useState('');
  const [date,     setDate]           = useState(month + '-01');
  const [desc,     setDesc]           = useState('');
  const [confidential, setConfidential] = useState(false);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [filterCat, setFilterCat]     = useState<ExpenseCategory | ''>('');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', month],
    queryFn:  () => api.get<Expense[]>('/finance/expenses', { params: { month } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: object) => api.post('/finance/expenses', d).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses', month] }); resetForm(); },
  });

  const editMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: object }) => api.patch(`/finance/expenses/${id}`, d).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses', month] }); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/finance/expenses/${id}`).then(r => r.data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses', month] }); setDeleteId(null); },
  });

  function resetForm() {
    setShowForm(false); setEditTarget(null);
    setTitle(''); setCategory('other'); setAmount(''); setDesc(''); setConfidential(false);
    setDate(month + '-01');
  }

  function startEdit(e: Expense) {
    setEditTarget(e); setShowForm(true);
    setTitle(e.title); setCategory(e.category);
    setAmount(String(e.amount)); setDate(e.expenseDate.slice(0,10));
    setDesc(e.description ?? ''); setConfidential(e.isConfidential);
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const payload = { title, category, amount: parseInt(amount), expenseDate: date, description: desc || undefined, isConfidential: confidential };
    if (editTarget) editMut.mutate({ id: editTarget.id, d: payload });
    else createMut.mutate(payload);
  }

  const filtered  = (expenses ?? []).filter(e => !filterCat || e.category === filterCat);
  const totalShown = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-5">

      {/* Sarlavha + tugmalar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filterCat} onChange={e => setFilterCat(e.target.value as ExpenseCategory | '')}
            className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            <option value="">Barcha kategoriya</option>
            {CATS.map(c => <option key={c} value={c}>{EXPENSE_CATEGORIES[c].icon} {EXPENSE_CATEGORIES[c].label}</option>)}
          </select>
          <span className="text-sm text-gray-500">
            Jami: <strong>{fmtM(totalShown)} so'm</strong>
          </span>
        </div>
        <button onClick={() => { resetForm(); setShowForm(s => !s); }}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
            showForm ? 'bg-gray-100 text-gray-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}>
          {showForm ? '✕ Yopish' : '+ Xarajat qo\'shish'}
        </button>
      </div>

      {/* Forma */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">
            {editTarget ? '✏️ Xarajatni tahrirlash' : '+ Yangi xarajat'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nomi *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className={INPUT} placeholder="Ijara to'lovi..." required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategoriya</label>
              <select value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)} className={INPUT}>
                {CATS.map(c => <option key={c} value={c}>{EXPENSE_CATEGORIES[c].icon} {EXPENSE_CATEGORIES[c].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Summa (so'm) *</label>
              <input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} className={INPUT} placeholder="0" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sana *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT} required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Izoh</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} className={INPUT} placeholder="Ixtiyoriy..." />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={confidential} onChange={e => setConfidential(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            🔒 Maxfiy (faqat SA ko'radi)
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={resetForm}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Bekor
            </button>
            <button type="submit" disabled={createMut.isPending || editMut.isPending}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition">
              {(createMut.isPending || editMut.isPending) ? 'Saqlanmoqda...' : editTarget ? '✓ Saqlash' : '+ Qo\'shish'}
            </button>
          </div>
        </form>
      )}

      {/* Jadval */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nomi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Kategoriya</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Summa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Sana</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                : filtered.length === 0
                ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-gray-400">
                        <div className="text-5xl mb-3">📦</div>
                        <p>Xarajatlar topilmadi</p>
                      </td>
                    </tr>
                  )
                : filtered.map(e => {
                    const meta = EXPENSE_CATEGORIES[e.category] ?? EXPENSE_CATEGORIES.other;
                    return (
                      <tr key={e.id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{e.title}</p>
                          {e.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{e.description}</p>}
                          {e.isConfidential && <span className="text-xs text-gray-400">🔒 Maxfiy</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-red-600">
                          {fmtM(e.amount)} so'm
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400 hidden md:table-cell">
                          {new Date(e.expenseDate).toLocaleDateString('uz-UZ')}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(e)}
                              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors text-sm">✏️</button>
                            <button onClick={() => setDeleteId(e.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors text-sm">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* O'chirish dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="text-3xl mb-3">🗑️</div>
            <h3 className="font-semibold text-gray-900 mb-1">Xarajatni o'chirish</h3>
            <p className="text-gray-500 text-sm mb-5">Bu amal bekor qilinmaydi.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Bekor</button>
              <button onClick={() => deleteMut.mutate(deleteId!)} disabled={deleteMut.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition">
                {deleteMut.isPending ? 'O\'chirilmoqda...' : 'O\'chirish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

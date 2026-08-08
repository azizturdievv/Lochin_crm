'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import CashDenomination, { calcDenomTotal } from './CashDenomination';
import type { CashSession } from '@/types/payments';

const fetchActiveSession = () =>
  api.get<CashSession>('/payments/sessions/active').then(r => r.data).catch(() => null);

export default function SessionWidget() {
  const qc = useQueryClient();
  const [showClose, setShowClose] = useState(false);
  const [showOpen,  setShowOpen]  = useState(false);
  const [openBal,   setOpenBal]   = useState('');
  const [closeBal,  setCloseBal]  = useState('');
  const [denom,     setDenom]     = useState<Record<number, number>>({});
  const [notes,     setNotes]     = useState('');

  const { data: session, isLoading } = useQuery({
    queryKey: ['active-session'],
    queryFn:  fetchActiveSession,
    refetchInterval: 60_000,
  });

  const openMut = useMutation({
    mutationFn: (data: { openingBalance: number; notes?: string }) =>
      api.post('/payments/sessions/open', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session'] });
      setShowOpen(false); setOpenBal(''); setNotes('');
    },
  });

  const closeMut = useMutation({
    mutationFn: (data: { closingBalance: number; cashBreakdown?: object; notes?: string }) =>
      api.patch(`/payments/sessions/${session!.id}/close`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session', 'payments', 'dashboard-stats'] });
      setShowClose(false); setDenom({}); setNotes('');
    },
  });

  function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    openMut.mutate({ openingBalance: parseFloat(openBal) || 0, ...(notes && { notes }) });
  }

  function handleClose(e: React.FormEvent) {
    e.preventDefault();
    const denomTotal = calcDenomTotal(denom);
    const closing    = denomTotal > 0 ? denomTotal : parseFloat(closeBal) || 0;
    const breakdown: Record<string, number> = {};
    Object.entries(denom).forEach(([k,v]) => { if (v > 0) breakdown[k] = v; });
    closeMut.mutate({
      closingBalance: closing,
      ...(Object.keys(breakdown).length > 0 && { cashBreakdown: breakdown }),
      ...(notes && { notes }),
    });
  }

  if (isLoading) {
    return <div className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse h-20" />;
  }

  return (
    <>
      {/* Widget */}
      <div className={`border rounded-2xl p-4 ${session ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Smena holati</p>
            {session ? (
              <>
                <p className="text-sm font-bold text-emerald-700">Smena ochiq</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Boshlangan: {new Date(session.openedAt).toLocaleTimeString('uz-UZ', { hour:'2-digit', minute:'2-digit' })}
                </p>
                <p className="text-xs text-emerald-600">
                  Yig'ilgan: <strong>{session.totalCollected.toLocaleString('uz-UZ')} so'm</strong>
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-700">Smena yopiq</p>
                <p className="text-xs text-amber-600 mt-0.5">To'lov qabul qilish uchun smenani oching</p>
              </>
            )}
          </div>
          {session ? (
            <button onClick={() => setShowClose(true)}
              className="px-3 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-medium hover:bg-red-200 transition shrink-0">
              Yopish
            </button>
          ) : (
            <button onClick={() => setShowOpen(true)}
              className="px-3 py-2 bg-primary-600 text-white rounded-xl text-xs font-medium hover:bg-primary-700 transition shrink-0">
              Ochish
            </button>
          )}
        </div>
      </div>

      {/* ── SMENA OCHISH ─────────────────────────────────────────────── */}
      {showOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Smenani ochish</h3>
            <form onSubmit={handleOpen} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Boshlang'ich qoldiq (so'm)</label>
                <input type="number" min={0} value={openBal} onChange={e => setOpenBal(e.target.value)}
                  placeholder="0" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Izoh</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ixtiyoriy" />
              </div>
              {openMut.error && <p className="text-red-500 text-sm">Xatolik yuz berdi</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowOpen(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Bekor</button>
                <button type="submit" disabled={openMut.isPending}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
                  {openMut.isPending ? 'Ochilmoqda...' : 'Ochish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── SMENA YOPISH ─────────────────────────────────────────────── */}
      {showClose && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Smenani yopish</h3>
              <button onClick={() => setShowClose(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
            </div>
            <form onSubmit={handleClose} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Xulosa */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <Row label="Boshlang'ich qoldiq" value={`${session.openingBalance.toLocaleString('uz-UZ')} so'm`} />
                <Row label="Yig'ilgan"           value={`${session.totalCollected.toLocaleString('uz-UZ')} so'm`} />
                <Row label="Sana"                value={new Date(session.openedAt).toLocaleString('uz-UZ', { dateStyle:'short', timeStyle:'short' })} />
              </div>

              <CashDenomination
                value={denom}
                onChange={(d, c) => setDenom(prev => ({ ...prev, [d]: c }))}
                label="Faktik pul sanash (ixtiyoriy)"
              />

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Faktik qoldiq (so'm)</label>
                <input
                  type="number" min={0} value={closeBal}
                  onChange={e => setCloseBal(e.target.value)}
                  placeholder={`Kutilgan: ${(session.openingBalance + session.totalCollected).toLocaleString('uz-UZ')}`}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-xs text-gray-400 mt-1">Kupyura hisoblasa — u ustuvor qabul qilinadi</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Izoh</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Ixtiyoriy" />
              </div>

              {closeMut.error && <p className="text-red-500 text-sm">Xatolik yuz berdi</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowClose(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Bekor</button>
                <button type="submit" disabled={closeMut.isPending}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition">
                  {closeMut.isPending ? 'Yopilmoqda...' : 'Yopish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

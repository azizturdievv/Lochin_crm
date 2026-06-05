'use client';

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Payment } from '@/types/payments';
import { METHOD_META } from '@/types/payments';

interface Props {
  payment: Payment | null;
  onClose: () => void;
}

function fmtNum(n: number) {
  return n.toLocaleString('uz-UZ');
}

export default function ReceiptModal({ payment, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const markPrintedMut = useMutation({
    mutationFn: (id: string) => api.patch(`/payments/${id}/print`).then(r => r.data),
  });

  if (!payment) return null;

  function handlePrint() {
    const content = printRef.current;
    if (!content || !payment) return;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;

    win.document.write(`
      <html><head>
        <title>Kvitansiya #${payment.id.slice(0,8).toUpperCase()}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; font-family: 'Courier New', monospace; }
          body { padding: 16px; font-size: 12px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; padding: 3px 0; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .large { font-size: 18px; font-weight: bold; }
          .title { font-size: 14px; font-weight: bold; letter-spacing: 1px; }
        </style>
      </head><body>
        <div class="center">
          <div class="title">ILM ACADEMY</div>
          <div class="center" style="font-size:10px; margin:2px 0">To'lov kvitansiyasi</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Raqam:</span><span class="bold">#${payment.id.slice(0,8).toUpperCase()}</span></div>
        <div class="row"><span>Sana:</span><span>${new Date(payment.createdAt).toLocaleString('uz-UZ')}</span></div>
        <div class="divider"></div>
        <div class="row"><span>O'quvchi:</span><span class="bold">${payment.student.lastName} ${payment.student.firstName}</span></div>
        ${payment.student.phone ? `<div class="row"><span>Telefon:</span><span>${payment.student.phone}</span></div>` : ''}
        <div class="divider"></div>
        <div class="row"><span>To'lov usuli:</span><span>${METHOD_META[payment.method].label}</span></div>
        ${payment.paymentMonth ? `<div class="row"><span>Oy:</span><span>${payment.paymentMonth}</span></div>` : ''}
        ${payment.method === 'mixed' ? `
        <div class="row"><span>Naqd qismi:</span><span>${fmtNum(payment.cashAmount ?? 0)} so'm</span></div>
        <div class="row"><span>Karta qismi:</span><span>${fmtNum(payment.cardAmount ?? 0)} so'm</span></div>
        ` : ''}
        <div class="divider"></div>
        <div class="center">
          <div style="margin:8px 0">TO'LANGAN SUMMA:</div>
          <div class="large">${fmtNum(payment.amount)} so'm</div>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Kassir:</span><span>${payment.receivedBy.lastName} ${payment.receivedBy.firstName}</span></div>
        ${payment.notes ? `<div class="row"><span>Izoh:</span><span>${payment.notes}</span></div>` : ''}
        <div class="divider"></div>
        <div class="center" style="font-size:10px; margin-top:8px">Rahmat! Ilm Academy</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();

    markPrintedMut.mutate(payment.id);
  }

  async function handleDownloadPdf() {
    if (!payment) return;
    try {
      const res = await api.get(`/payments/${payment.id}/receipt`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `kvitansiya-${payment.id.slice(0,8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: print
      handlePrint();
    }
  }

  const meta = METHOD_META[payment.method];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-emerald-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Kvitansiya</h2>
            <button onClick={onClose} className="opacity-80 hover:opacity-100 transition">✕</button>
          </div>
          <p className="text-emerald-100 text-xs mt-0.5">#{payment.id.slice(0,8).toUpperCase()}</p>
        </div>

        {/* Receipt body */}
        <div ref={printRef} className="px-6 py-5 space-y-4 font-mono text-sm">
          {/* Markaz */}
          <div className="text-center border-b border-dashed border-gray-300 pb-4">
            <p className="font-bold text-base tracking-wide">ILM ACADEMY</p>
            <p className="text-gray-400 text-xs">To'lov kvitansiyasi</p>
          </div>

          {/* Info qatorlar */}
          <div className="space-y-2">
            <Row label="O'quvchi" value={`${payment.student.lastName} ${payment.student.firstName}`} bold />
            {payment.student.phone && <Row label="Telefon" value={payment.student.phone} />}
            <Row label="Sana"  value={new Date(payment.createdAt).toLocaleString('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' })} />
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 space-y-2">
            <Row label="Usul"  value={`${meta.icon} ${meta.label}`} />
            {payment.paymentMonth && <Row label="Oy"  value={payment.paymentMonth} />}
            {payment.method === 'mixed' && (
              <>
                <Row label="Naqd"  value={`${fmtNum(payment.cashAmount ?? 0)} so'm`} />
                <Row label="Karta" value={`${fmtNum(payment.cardAmount ?? 0)} so'm`} />
              </>
            )}
            {payment.notes && <Row label="Izoh" value={payment.notes} />}
          </div>

          {/* Jami */}
          <div className="border-t-2 border-gray-800 pt-3 text-center">
            <p className="text-xs text-gray-500 mb-1">TO'LANGAN SUMMA</p>
            <p className="text-2xl font-bold text-gray-900">{fmtNum(payment.amount)} <span className="text-base font-medium text-gray-500">so'm</span></p>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3">
            <Row label="Kassir" value={`${payment.receivedBy.lastName} ${payment.receivedBy.firstName}`} />
            {payment.printedAt && <p className="text-xs text-gray-400 mt-1">Chop: {new Date(payment.printedAt).toLocaleString('uz-UZ')}</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 grid grid-cols-2 gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            🖨️ Chop etish
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
          >
            ⬇️ PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-gray-400 shrink-0">{label}:</span>
      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Info, X, RotateCw } from 'lucide-react';
import { useToastStore, type ToastItem } from '@/store/toast.store';

const STYLES: Record<ToastItem['type'], { bg: string; border: string; icon: React.ReactNode }> = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="text-emerald-600" size={18} /> },
  error:   { bg: 'bg-red-50',     border: 'border-red-200',     icon: <XCircle className="text-red-600" size={18} /> },
  info:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: <Info className="text-blue-600" size={18} /> },
};

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [retrying, setRetrying] = useState(false);
  const style = STYLES[item.type];

  async function handleRetry() {
    if (!item.retry) return;
    setRetrying(true);
    try {
      await item.retry();
      dismiss(item.id); // muvaffaqiyatli — yopiladi
    } catch {
      setRetrying(false); // yana xato — retry tugmasi qoladi, foydalanuvchi яна urinishi mumkin
    }
  }

  return (
    <div className={`flex items-start gap-2.5 w-80 max-w-[calc(100vw-2rem)] rounded-xl border ${style.border} ${style.bg} shadow-lg px-4 py-3`}>
      <div className="shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{item.message}</p>
        {item.retry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-800 disabled:opacity-50"
          >
            <RotateCw size={12} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Urinilmoqda...' : 'Qayta urinish'}
          </button>
        )}
      </div>
      <button
        onClick={() => dismiss(item.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600"
        aria-label="Yopish"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard item={t} />
        </div>
      ))}
    </div>
  );
}

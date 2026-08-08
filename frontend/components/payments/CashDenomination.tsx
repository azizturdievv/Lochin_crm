'use client';

import { CASH_DENOMINATIONS } from '@/types/payments';

interface Props {
  value: Record<number, number>;
  onChange: (denom: number, count: number) => void;
  label?: string;
}

function fmt(n: number) {
  return n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(0)}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n);
}

export function calcDenomTotal(v: Record<number, number>): number {
  return CASH_DENOMINATIONS.reduce((s, d) => s + (v[d] ?? 0) * d, 0);
}

export default function CashDenomination({ value, onChange, label }: Props) {
  const total = calcDenomTotal(value);

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      {label && <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>}

      <div className="space-y-2">
        {CASH_DENOMINATIONS.map((denom) => {
          const count   = value[denom] ?? 0;
          const subtotal = count * denom;
          return (
            <div key={denom} className="grid grid-cols-[auto_1fr_auto] gap-3 items-center">
              {/* Kupyura nomi */}
              <div className="w-20 text-right">
                <span className="text-sm font-semibold text-gray-700">{fmt(denom)}</span>
                <span className="text-xs text-gray-400 ml-1">so'm</span>
              </div>
              {/* Dona kiritish */}
              <input
                type="number"
                min={0}
                value={count === 0 ? '' : count}
                onChange={e => onChange(denom, Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="w-full px-3 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
              {/* Jami */}
              <div className="w-24 text-right">
                {subtotal > 0 ? (
                  <span className="text-sm font-medium text-emerald-700">
                    = {subtotal.toLocaleString('uz-UZ')}
                  </span>
                ) : (
                  <span className="text-sm text-gray-300">= 0</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grand total */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <span className="text-sm font-medium text-gray-600">Jami:</span>
        <span className={`text-base font-bold ${total > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
          {total.toLocaleString('uz-UZ')} so'm
        </span>
      </div>
    </div>
  );
}

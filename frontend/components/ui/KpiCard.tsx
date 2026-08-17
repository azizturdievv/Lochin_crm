import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

// PreSkool uslubidagi KPI karta: oq fon, rangli icon plitkasi, ixtiyoriy Faol/Nofaol footer
interface KpiCardProps {
  title:     string;
  value:     string | number;
  sub?:      string;
  icon:      LucideIcon;
  color:     'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'primary';
  trend?:    { value: number; label: string };
  split?:    { active: string | number; inactive: string | number };
  splitLabels?: { active: string; inactive: string };
  loading?:  boolean;
  href?:     string;
  onClick?:  () => void;
}

const COLOR_MAP = {
  emerald: { icon: 'bg-emerald-100 text-emerald-600' },
  blue:    { icon: 'bg-blue-100 text-blue-600' },
  amber:   { icon: 'bg-amber-100 text-amber-600' },
  red:     { icon: 'bg-red-100 text-red-600' },
  purple:  { icon: 'bg-purple-100 text-purple-600' },
  primary: { icon: 'bg-primary-100 text-primary-600' },
};

export default function KpiCard({ title, value, sub, icon: Icon, color, trend, split, splitLabels, loading, href, onClick }: KpiCardProps) {
  const labels = splitLabels ?? { active: 'Faol', inactive: 'Nofaol' };
  const c = COLOR_MAP[color];

  const className = `bg-white border border-gray-100 shadow-sm rounded-2xl p-5 flex flex-col gap-3 text-left w-full${
    href || onClick ? ' hover:shadow-md hover:border-gray-200 transition-shadow cursor-pointer' : ''
  }`;

  const content = (
    <>
      <div className="flex items-start justify-between">
        <div className={`${c.icon} w-11 h-11 rounded-xl flex items-center justify-center`}>
          <Icon size={22} strokeWidth={2} />
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
            trend.value >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-gray-100 rounded-lg animate-pulse w-24" />
          <div className="h-4 bg-gray-50 rounded w-32 animate-pulse" />
        </div>
      ) : (
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-gray-600 text-sm font-medium mt-0.5">{title}</p>
          {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
          {trend && <p className="text-gray-400 text-xs mt-1">{trend.label}</p>}
        </div>
      )}

      {split && !loading && (
        <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-xs">
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {labels.active}: <b className="text-gray-900">{split.active}</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            {labels.inactive}: <b className="text-gray-900">{split.inactive}</b>
          </span>
        </div>
      )}
    </>
  );

  if (loading) return <div className={className}>{content}</div>;
  if (href) return <Link href={href} className={className}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={className}>{content}</button>;
  return <div className={className}>{content}</div>;
}

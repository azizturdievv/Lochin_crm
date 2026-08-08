import { AlertTriangle, Banknote, Percent, TrendingDown, TrendingUp, Upload, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { fmtM } from '@/types/finance';
import type { KpiData } from '@/types/finance';

interface Props {
  data?:    KpiData;
  loading:  boolean;
  prevData?: KpiData | null;
}

function trend(cur: number, prev: number | undefined): number | null {
  if (!prev || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

function TrendBadge({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const positive = invert ? pct < 0 : pct > 0;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-2 ${
      positive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
    }`}>
      {pct > 0 ? <TrendingUp size={12} className="inline" /> : <TrendingDown size={12} className="inline" />} {Math.abs(pct)}%
    </span>
  );
}

interface CardProps {
  icon:     LucideIcon;
  label:    string;
  value:    string;
  sub?:     string;
  bg:       string;
  textCls:  string;
  loading:  boolean;
  trend?:   number | null;
  invertTrend?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, bg, textCls, loading, trend: t, invertTrend }: CardProps) {
  return (
    <div className={`${bg} rounded-2xl p-5`}>
      <Icon size={20} className="mb-3" />
      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-white/50 rounded-lg animate-pulse w-24" />
          <div className="h-4 bg-white/30 rounded w-32 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="flex items-center flex-wrap gap-1">
            <p className={`text-xl font-bold ${textCls}`}>{value}</p>
            <TrendBadge pct={t ?? null} invert={invertTrend} />
          </div>
          <p className={`text-xs mt-0.5 opacity-70 ${textCls}`}>{label}</p>
          {sub && <p className={`text-xs mt-1 opacity-50 ${textCls}`}>{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function KpiGrid({ data, loading, prevData }: Props) {
  const margin = data?.marginPercent ?? 0;
  const marginCls = margin >= 30 ? 'bg-emerald-50' : margin >= 15 ? 'bg-amber-50' : 'bg-red-50';
  const marginTxt = margin >= 30 ? 'text-emerald-700' : margin >= 15 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        icon={Banknote} label="Daromad" loading={loading}
        value={`${fmtM(data?.totalIncome ?? 0)} so'm`}
        sub={`Prev: ${fmtM(prevData?.totalIncome ?? 0)}`}
        trend={trend(data?.totalIncome ?? 0, prevData?.totalIncome)}
        bg="bg-emerald-50" textCls="text-emerald-700"
      />
      <KpiCard
        icon={Upload} label="Xarajat" loading={loading}
        value={`${fmtM(data?.totalExpenses ?? 0)} so'm`}
        trend={trend(data?.totalExpenses ?? 0, prevData?.totalExpenses)}
        invertTrend
        bg="bg-red-50" textCls="text-red-700"
      />
      <KpiCard
        icon={TrendingUp} label="Sof foyda" loading={loading}
        value={`${fmtM(data?.netProfit ?? 0)} so'm`}
        trend={trend(data?.netProfit ?? 0, prevData?.netProfit)}
        bg="bg-blue-50" textCls="text-blue-700"
      />
      <KpiCard
        icon={Percent} label="Marja" loading={loading}
        value={`${data?.marginPercent ?? 0}%`}
        bg={marginCls} textCls={marginTxt}
      />
      <KpiCard
        icon={Users} label="O'quvchilar" loading={loading}
        value={`${data?.activeStudents ?? 0} ta`}
        trend={trend(data?.activeStudents ?? 0, prevData?.activeStudents)}
        bg="bg-purple-50" textCls="text-purple-700"
      />
      <KpiCard
        icon={AlertTriangle} label="Qarzdorlar" loading={loading}
        value={`${data?.debtorCount ?? 0} ta`}
        sub={`${fmtM(data?.debtAmount ?? 0)} so'm`}
        bg="bg-amber-50" textCls="text-amber-700"
      />
    </div>
  );
}

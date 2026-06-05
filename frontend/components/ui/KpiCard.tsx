interface KpiCardProps {
  title:     string;
  value:     string | number;
  sub?:      string;
  icon:      string;
  color:     'emerald' | 'blue' | 'amber' | 'red' | 'purple';
  trend?:    { value: number; label: string };
  loading?:  boolean;
}

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600' },
  blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',       text: 'text-blue-600'    },
  amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',     text: 'text-amber-600'   },
  red:     { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',         text: 'text-red-600'     },
  purple:  { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600',   text: 'text-purple-600'  },
};

export default function KpiCard({ title, value, sub, icon, color, trend, loading }: KpiCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={`${c.bg} rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between">
        <div className={`${c.icon} w-11 h-11 rounded-xl flex items-center justify-center text-xl`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trend.value >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-7 bg-white/60 rounded-lg animate-pulse w-24" />
          <div className="h-4 bg-white/40 rounded w-32 animate-pulse" />
        </div>
      ) : (
        <div>
          <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
          <p className="text-gray-600 text-sm font-medium mt-0.5">{title}</p>
          {sub && <p className="text-gray-400 text-xs mt-0.5">{sub}</p>}
          {trend && <p className="text-gray-400 text-xs mt-1">{trend.label}</p>}
        </div>
      )}
    </div>
  );
}

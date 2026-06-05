'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { STAGE_META, SOURCE_META, STAGE_ORDER } from '@/types/leads';
import type { Lead, LeadStage, LeadSource, LeadStats } from '@/types/leads';
import LeadCard from '@/components/leads/LeadCard';
import LeadModal from '@/components/leads/LeadModal';
import { useAuthStore } from '@/store/auth.store';

// 15 daqiqa qoidasi: faqat 'new' bosqich
const ALERT_STAGES: LeadStage[] = ['new'];

// Manba filtri variantlari
const SOURCE_OPTIONS: Array<{ value: LeadSource | 'all'; label: string; icon: string }> = [
  { value: 'all',      label: 'Barchasi', icon: '🔍' },
  { value: 'instagram',label: 'Instagram',icon: '📸' },
  { value: 'telegram', label: 'Telegram', icon: '✈️' },
  { value: 'call',     label: "Qo'ng'iroq",icon: '📞' },
  { value: 'website',  label: 'Website',  icon: '🌐' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'walk_in',  label: 'Walk-in',  icon: '🚶' },
];

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export default function LeadsPage() {
  const user = useAuthStore(s => s.user);
  const qc   = useQueryClient();

  const [search,     setSearch]     = useState('');
  const [sourceFilter, setSource]   = useState<LeadSource | 'all'>('all');
  const [modalLead,  setModalLead]  = useState<Lead | null | undefined>(undefined);
  // undefined = yopiq, null = yangi, Lead = tahrirlash

  // ─── Ma'lumotlar ─────────────────────────────────────────────────────────────
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn:  () => api.get('/leads').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : (d?.data ?? d?.items ?? [])) as Lead[];
    }),
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery<LeadStats>({
    queryKey: ['lead-stats'],
    queryFn:  () => api.get<LeadStats>('/leads/stats').then(r => r.data),
    refetchInterval: 60_000,
  });

  // Bosqich o'zgartirish
  const stageMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadStage }) =>
      api.patch(`/leads/${id}/stage`, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead-stats'] });
    },
  });

  // ─── Filtrlash ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = !search ||
        `${l.firstName} ${l.lastName} ${l.phone}`.toLowerCase().includes(search.toLowerCase());
      const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
      return matchSearch && matchSource;
    });
  }, [leads, search, sourceFilter]);

  // Bosqich bo'yicha guruhlash
  const byStage = useMemo<Record<LeadStage, Lead[]>>(() => {
    const groups = {} as Record<LeadStage, Lead[]>;
    STAGE_ORDER.forEach(s => { groups[s] = []; });
    filtered.forEach(l => { groups[l.stage]?.push(l); });
    return groups;
  }, [filtered]);

  // Ochiq "yangi" lidlar alert
  const alertCount = useMemo(() =>
    leads.filter(l =>
      ALERT_STAGES.includes(l.stage) &&
      !l.firstResponseAt &&
      minutesSince(l.createdAt) > 15
    ).length,
  [leads]);

  // ─── Bosqich o'tkazish ────────────────────────────────────────────────────────
  function handleStageChange(lead: Lead, direction: 'next' | 'prev') {
    const idx  = STAGE_ORDER.indexOf(lead.stage);
    const next = direction === 'next' ? STAGE_ORDER[idx + 1] : STAGE_ORDER[idx - 1];
    if (!next || next === 'lost' && direction === 'next' && lead.stage !== 'enrolled') {
      if (direction === 'next' && lead.stage === 'trial') {
        // Trial → enrolled yoki lost ni so'raymiz
        const choice = confirm(
          "O'quvchi qabul qilindimi?\n\nOK = O'quvchi qilish\nBekor = Yo'qotildi"
        );
        stageMut.mutate({ id: lead.id, stage: choice ? 'enrolled' : 'lost' });
        return;
      }
    }
    if (!next) return;
    stageMut.mutate({ id: lead.id, stage: next });
  }

  // ─── Konversiya hisoblash ─────────────────────────────────────────────────────
  const convRate = stats?.conversionRate != null
    ? `${stats.conversionRate.toFixed(1)}%`
    : leads.length
      ? `${((byStage.enrolled?.length / leads.length) * 100).toFixed(1)}%`
      : '0%';

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl shrink-0">
              🎯
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Lid boshqaruvi</h1>
              <p className="text-xs text-gray-400">{leads.length} ta lid</p>
            </div>
            {alertCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full animate-pulse border border-red-200">
                🔴 {alertCount} lid 15 daqiqa javob kutmoqda!
              </div>
            )}
          </div>

          <button
            onClick={() => setModalLead(null)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0"
          >
            + Yangi lid
          </button>
        </div>

        {/* KPI kartalar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Jami lidlar"     value={leads.length}            color="blue"   icon="👥" />
          <StatCard label="Konversiya"       value={convRate}                color="emerald"icon="📈" />
          <StatCard label="Sinov darsi"      value={byStage.trial?.length}   color="purple" icon="🎓" />
          <StatCard
            label="O'rtacha javob"
            value={stats?.avgResponseMinutes != null ? `${stats.avgResponseMinutes} daq` : '—'}
            color={stats?.avgResponseMinutes != null && stats.avgResponseMinutes > 15 ? 'red' : 'emerald'}
            icon="⏱"
          />
        </div>

        {/* Qidiruv va filtr */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            className="flex-1 min-w-[200px] px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            {SOURCE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSource(opt.value as LeadSource | 'all')}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                  sourceFilter === opt.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:text-emerald-700'
                }`}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Pipeline kanban ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto p-6">
        {isLoading ? (
          <div className="flex gap-4">
            {STAGE_ORDER.map(s => (
              <div key={s} className="w-64 shrink-0 space-y-3">
                <div className="h-8 bg-gray-100 rounded-xl animate-pulse" />
                {[1,2,3].map(i => (
                  <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4 min-w-max">
            {STAGE_ORDER.map(stage => {
              const meta  = STAGE_META[stage];
              const cards = byStage[stage] ?? [];
              const count = cards.length;

              return (
                <div key={stage} className="w-64 shrink-0 flex flex-col gap-3">
                  {/* Ustun sarlavhasi */}
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-2xl ${meta.bg} ${meta.border} border`}>
                    <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
                      {count}
                    </span>
                  </div>

                  {/* Kartalar */}
                  <div className="flex flex-col gap-2.5">
                    {count === 0 ? (
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl h-24 flex items-center justify-center text-gray-300 text-sm">
                        Bo'sh
                      </div>
                    ) : (
                      cards.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={setModalLead}
                          onStage={handleStageChange}
                          is15Min={ALERT_STAGES.includes(lead.stage)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalLead !== undefined && (
        <LeadModal
          lead={modalLead}
          onClose={() => setModalLead(undefined)}
        />
      )}
    </div>
  );
}

// ─── KPI karta ───────────────────────────────────────────────────────────────
function StatCard({
  label, value, color, icon,
}: { label: string; value: string | number | undefined; color: string; icon: string }) {
  const colors: Record<string, string> = {
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    purple:  'bg-purple-50 text-purple-700',
    red:     'bg-red-50 text-red-700',
    amber:   'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${colors[color] ?? colors.blue}`}>
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{value ?? '—'}</p>
        <p className="text-xs opacity-70 truncate">{label}</p>
      </div>
    </div>
  );
}

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SOURCE_META, STAGE_META } from '@/types/leads';
import type { Lead } from '@/types/leads';

interface Props {
  lead:     Lead;
  onClick:  (lead: Lead) => void;
  onStage:  (lead: Lead, direction: 'next' | 'prev') => void;
  is15Min:  boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'Hozir';
  if (m < 60)  return `${m} daq`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} soat`;
  return `${Math.floor(h / 24)} kun`;
}

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

export default function LeadCard({ lead, onClick, onStage, is15Min }: Props) {
  const src   = lead.source ? SOURCE_META[lead.source] : null;
  const stage = STAGE_META[lead.stage];
  const mins  = minutesSince(lead.createdAt);
  const alert = is15Min && !lead.firstContactAt && mins > 15;

  return (
    <div
      onClick={() => onClick(lead)}
      className={`bg-white rounded-2xl p-3.5 shadow-sm border cursor-pointer hover:shadow-md transition-all group ${
        alert ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
      }`}
    >
      {/* 15 daqiqa alert banner */}
      {alert && (
        <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-[11px] font-medium rounded-xl px-2.5 py-1.5 mb-2.5">
          <span className="animate-pulse"></span>
          <span>{mins} daqiqa javob yo'q!</span>
        </div>
      )}

      {/* Ism va manba */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
            {lead.fullName}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{lead.phone}</p>
        </div>
        {src && (
          <span className="text-lg shrink-0" title={src.label}><src.icon size={14} className="shrink-0" /></span>
        )}
      </div>

      {/* Fan */}
      <div className="flex flex-wrap gap-1 mb-2.5">
        {lead.interestedSubject && (
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {lead.interestedSubject}
          </span>
        )}
      </div>

      {/* Mas'ul va vaqt */}
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>
          {lead.assignedTo
            ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName[0]}.`
            : 'Tayinlanmagan'}
        </span>
        <span title={new Date(lead.createdAt).toLocaleString('uz-UZ')}>
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* Bosqich o'girish tugmalari */}
      <div
        className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onStage(lead, 'prev')}
          disabled={lead.stage === 'new' || lead.stage === 'lost'}
          className="text-[11px] text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={12} /> Orqaga
        </button>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${stage.color} ${stage.bg}`}>
          {stage.label}
        </span>
        <button
          onClick={() => onStage(lead, 'next')}
          disabled={lead.stage === 'enrolled' || lead.stage === 'lost'}
          className="text-[11px] text-gray-400 hover:text-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
        >
          Oldinga <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

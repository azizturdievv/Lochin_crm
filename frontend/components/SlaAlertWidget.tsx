'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, Target, ClipboardX } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

const LEAD_SLA_MIN = 15;
const ATTENDANCE_SLA_MIN = 15;
const POLL_MS = 30_000;

interface LeadRow { id: string; fullName: string; firstContactAt: string | null }
interface PipelineResponse {
  pipeline: Record<string, { leads: LeadRow[]; count: number }>;
}
interface TodayRow {
  lesson: { id: string; startTime: string | null; lessonDate: string; group: { name: string } };
  stats:  { absent: number };
}

interface Breach { key: string; kind: 'lead' | 'attendance'; label: string; minutesOver: number; onClick: () => void }

// Qisqa "bip" tovushi — statik audio fayl kerak emas (Web Audio API)
function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Brauzer audio siyosati bloklagan bo'lishi mumkin (foydalanuvchi hali sahifa bilan ishlamagan) — jim o'tamiz
  }
}

function minutesSince(dateStr: string, timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const start = new Date(dateStr);
  start.setHours(h, m, 0, 0);
  return Math.floor((Date.now() - start.getTime()) / 60_000);
}

export default function SlaAlertWidget() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const enabled = role === 'super_admin' || role === 'manager';

  const [openPanel, setOpenPanel] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: pipeline } = useQuery({
    queryKey: ['sla-leads'],
    queryFn:  () => api.get<PipelineResponse>('/leads/pipeline').then((r) => r.data),
    enabled,
    refetchInterval: POLL_MS,
  });

  const { data: today } = useQuery({
    queryKey: ['sla-attendance'],
    queryFn:  () => api.get<TodayRow[]>('/attendance/today').then((r) => r.data),
    enabled,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpenPanel(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!enabled) return null;

  const leadBreaches: Breach[] = (pipeline?.pipeline?.new?.leads ?? [])
    .filter((l) => l.firstContactAt)
    .map((l) => ({ l, mins: Math.floor((Date.now() - new Date(l.firstContactAt!).getTime()) / 60_000) }))
    .filter(({ mins }) => mins >= LEAD_SLA_MIN)
    .map(({ l, mins }) => ({
      key: `lead:${l.id}`,
      kind: 'lead' as const,
      label: `${l.fullName} — javob kutmoqda`,
      minutesOver: mins,
      onClick: () => { router.push('/dashboard/leads'); setOpenPanel(false); },
    }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const attendanceBreaches: Breach[] = (today ?? [])
    .filter((r) => r.lesson.lessonDate?.slice(0, 10) === todayStr && r.lesson.startTime && r.stats.absent > 0)
    .map((r) => ({ r, mins: minutesSince(r.lesson.lessonDate, r.lesson.startTime!) }))
    .filter(({ mins }) => mins >= ATTENDANCE_SLA_MIN && mins < 24 * 60)
    .map(({ r, mins }) => ({
      key: `att:${r.lesson.id}`,
      kind: 'attendance' as const,
      label: `${r.lesson.group.name} — ${r.stats.absent} o'quvchi kelmadi`,
      minutesOver: mins,
      onClick: () => { router.push('/dashboard/attendance'); setOpenPanel(false); },
    }));

  const breaches = [...leadBreaches, ...attendanceBreaches].sort((a, b) => b.minutesOver - a.minutesOver);

  // Yangi (ilgari ko'rilmagan) buzilish paydo bo'lsa — tovush
  useEffect(() => {
    const newOnes = breaches.filter((b) => !seenRef.current.has(b.key));
    if (newOnes.length > 0 && seenRef.current.size > 0) {
      playBeep();
    }
    breaches.forEach((b) => seenRef.current.add(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breaches.map((b) => b.key).join(',')]);

  const count = breaches.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpenPanel((o) => !o)}
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
          count > 0 ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-gray-400 hover:bg-gray-50'
        }`}
        aria-label="SLA ogohlantirishlari"
      >
        <AlarmClock size={17} className={count > 0 ? 'animate-pulse' : ''} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {openPanel && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">SLA ogohlantirishlari</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">15 daqiqa qoidasi — javobsiz lidlar va kelmagan o'quvchilar</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {breaches.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">Hammasi tartibda ✅</p>
            ) : (
              breaches.map((b) => (
                <button
                  key={b.key}
                  onClick={b.onClick}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                >
                  <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    b.kind === 'lead' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {b.kind === 'lead' ? <Target size={14} /> : <ClipboardX size={14} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{b.label}</p>
                    <p className="text-[10px] text-gray-400">{b.minutesOver} daqiqadan beri</p>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { Activity, Bot, ClipboardList, Crown, Download, Dumbbell, Medal, Trophy, VenetianMask, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { EVENT_TYPE_META, EVENT_STATUS_META, daysUntil } from '@/types/events';
import type { CrmEvent, EventType, EventStatus, Certificate } from '@/types/events';
import EventCard       from '@/components/events/EventCard';
import CreateEventModal from '@/components/events/CreateEventModal';
import ParticipantsModal from '@/components/events/ParticipantsModal';
import LeaderboardPanel from '@/components/events/LeaderboardPanel';

const TYPE_FILTERS: Array<{ v: EventType | 'all'; label: string; icon: LucideIcon }> = [
  { v: 'all',      label: 'Barchasi',    icon: ClipboardList },
  { v: 'olympiad', label: 'Olimpiada',   icon: Medal },
  { v: 'sport',    label: 'Sport',       icon: Dumbbell },
  { v: 'robotics', label: 'Robotika',    icon: Bot },
  { v: 'chess',    label: 'Shaxmat',     icon: Crown },
  { v: 'running',  label: 'Yugurish',    icon: Activity },
  { v: 'cultural', label: 'Madaniy',     icon: VenetianMask },
];

const STATUS_FILTERS: Array<{ v: EventStatus | 'all'; label: string }> = [
  { v: 'all',       label: 'Barchasi'        },
  { v: 'upcoming',  label: 'Rejalashtirilgan'},
  { v: 'ongoing',   label: 'Davom etmoqda'   },
  { v: 'completed', label: 'Yakunlandi'      },
];

export default function EventsPage() {
  const user   = useAuthStore(s => s.user);
  const role   = user?.role ?? 'student';
  const qc     = useQueryClient();

  const [typeFilter,   setTypeFilter]   = useState<EventType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'all'>('upcoming');
  const [createOpen,   setCreateOpen]   = useState(false);
  const [manageEvent,  setManageEvent]  = useState<CrmEvent | null>(null);
  const [viewEvent,    setViewEvent]    = useState<CrmEvent | null>(null);

  const canManage = role === 'super_admin' || role === 'manager';

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn:  () => api.get('/events').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : (d?.data ?? d?.items ?? [])) as CrmEvent[];
    }),
  });

  const registerMut = useMutation({
    mutationFn: (eventId: string) => api.post(`/events/${eventId}/register`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const filtered = useMemo(() => {
    return events.filter(e => {
      const tOk = typeFilter   === 'all' || e.type   === typeFilter;
      const sOk = statusFilter === 'all' || e.status === statusFilter;
      return tOk && sOk;
    });
  }, [events, typeFilter, statusFilter]);

  // Statistika
  const stats = useMemo(() => ({
    upcoming:  events.filter(e => e.status === 'upcoming').length,
    ongoing:   events.filter(e => e.status === 'ongoing').length,
    myCount:   events.filter(e => e.myParticipation).length,
    soon:      events.filter(e => e.status === 'upcoming' && daysUntil(e.eventDate) <= 7).length,
  }), [events]);

  return (
    <div className="flex flex-col h-full">
      {/* ─── Sarlavha ─────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white text-xl shrink-0"><Trophy size={16} /></div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Tadbirlar</h1>
              <p className="text-xs text-gray-400">{events.length} ta tadbir</p>
            </div>
          </div>
          {canManage && (
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shrink-0"
            >
              + Yangi tadbir
            </button>
          )}
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{stats.upcoming}</div>
            <div className="text-[10px] text-blue-600">Rejalashtirilgan</div>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{stats.ongoing}</div>
            <div className="text-[10px] text-emerald-600">Davom etmoqda</div>
          </div>
          <div className="bg-purple-50 rounded-2xl p-3 text-center">
            <div className="text-xl font-bold text-purple-700">{stats.myCount}</div>
            <div className="text-[10px] text-purple-600">Mening tadbirlarim</div>
          </div>
          <div className={`rounded-2xl p-3 text-center ${stats.soon > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
            <div className={`text-xl font-bold ${stats.soon > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
              {stats.soon}
            </div>
            <div className={`text-[10px] ${stats.soon > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
              7 kunda boshlanadi
            </div>
          </div>
        </div>

        {/* Filtrlar */}
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button
                key={f.v}
                onClick={() => setTypeFilter(f.v as EventType | 'all')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                  typeFilter === f.v
                    ? 'bg-primary-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <f.icon size={14} className="shrink-0" /> {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.v}
                onClick={() => setStatusFilter(f.v as EventStatus | 'all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  statusFilter === f.v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tadbirlar grid ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="text-5xl"><Trophy size={16} /></div>
            <p className="text-sm font-medium text-gray-500">Tadbirlar topilmadi</p>
            {canManage && (
              <button
                onClick={() => setCreateOpen(true)}
                className="text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
              >
                + Yangi tadbir yaratish
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onView={e => setViewEvent(e)}
                onRegister={e => registerMut.mutate(e.id)}
                onManage={e => setManageEvent(e)}
                canManage={canManage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {createOpen && <CreateEventModal onClose={() => setCreateOpen(false)} />}
      {manageEvent && (
        <ParticipantsModal
          event={events.find(e => e.id === manageEvent.id) ?? manageEvent}
          onClose={() => setManageEvent(null)}
        />
      )}
      {viewEvent && !canManage && (
        <EventDetailModal
          event={events.find(e => e.id === viewEvent.id) ?? viewEvent}
          onClose={() => setViewEvent(null)}
        />
      )}
    </div>
  );
}

// ─── O'quvchi/Ustoz uchun oddiy detail modal ──────────────────────────────────
function EventDetailModal({ event, onClose }: { event: CrmEvent; onClose: () => void }) {
  const typeMeta   = EVENT_TYPE_META[event.type];
  const statusMeta = EVENT_STATUS_META[event.status];
  const myPart     = event.myParticipation;
  const userId     = useAuthStore(s => s.user?.id);

  const { data: myCerts = [] } = useQuery({
    queryKey: ['my-certificates', userId],
    queryFn:  () => api.get<Certificate[]>(`/events/certificates/student/${userId}`).then(r => r.data),
    enabled:  !!userId && !!myPart,
  });
  const myCert = myCerts.find(c => c.eventId === event.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <typeMeta.icon size={22} className="shrink-0" />
            <h2 className="text-base font-bold text-gray-900">{event.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeMeta.bg} ${typeMeta.color}`}>
              {typeMeta.label}
            </span>
          </div>
          {event.description && <p className="text-sm text-gray-700">{event.description}</p>}
          <div className="space-y-1.5 text-sm text-gray-500">
            <p>{new Date(event.eventDate).toLocaleString('uz-UZ')}</p>
            {event.location && <p>{event.location}</p>}
            <p>{event.participantsCount}{event.maxParticipants ? `/${event.maxParticipants}` : ''}</p>
            {event.hasFee && <p>{event.feeAmount?.toLocaleString()} so'm</p>}
          </div>
          {myPart?.permitQr && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="text-xs font-semibold text-gray-700">Sizning QR ruxsatnomangiz</p>
              <img src={myPart.permitQr} alt="QR" className="w-40 h-40 rounded-xl" />
              <a href={myPart.permitQr} download={`ruxsatnoma-${myPart.permitCode ?? myPart.id}.png`} className="text-xs text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-xl">
                <Download size={14} /> Yuklab olish
              </a>
            </div>
          )}
          {myCert?.fileUrl && (
            <a
              href={myCert.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              Sertifikatni ko'rish
            </a>
          )}

          {/* Onlayn musobaqa — test yechish / natija */}
          {event.isOnline && myPart && (
            <div className="pt-1">
              {myPart.score !== null ? (
                <div className="text-center py-3 bg-emerald-50 rounded-xl">
                  <p className="text-xs text-emerald-600">Sizning natijangiz</p>
                  <p className="text-lg font-bold text-emerald-800">
                    {Number(myPart.score)} ball{myPart.place ? ` · ${myPart.place}-o'rin` : ''}
                  </p>
                </div>
              ) : event.competitionStatus === 'ongoing' ? (
                myPart.paymentStatus === 'pending' ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl py-2.5 text-center">
                    To'lov tasdiqlanmagan — testni boshlash uchun to'lovni tasdiqlatish kerak
                  </p>
                ) : (
                  <Link
                    href={`/dashboard/events/${event.id}/compete`}
                    className="flex items-center justify-center w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors"
                  >
                    Testni boshlash
                  </Link>
                )
              ) : event.competitionStatus === 'finished' ? (
                <p className="text-xs text-gray-400 text-center py-2">Musobaqa yakunlandi</p>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">Musobaqa hali boshlanmagan</p>
              )}
            </div>
          )}

          {event.isOnline && event.competitionStatus !== 'not_started' && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">Reyting</p>
              <LeaderboardPanel eventId={event.id} live={event.competitionStatus === 'ongoing'} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

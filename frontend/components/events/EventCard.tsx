'use client';

import { Calendar, MapPin } from 'lucide-react';
import { formatLongDate, formatTime } from '@/lib/date';
import { EVENT_TYPE_META, EVENT_STATUS_META, daysUntil } from '@/types/events';
import type { CrmEvent } from '@/types/events';

interface Props {
  event:        CrmEvent;
  onView:       (e: CrmEvent) => void;
  onRegister:   (e: CrmEvent) => void;
  onManage:     (e: CrmEvent) => void;
  canManage:    boolean;
}

export default function EventCard({ event, onView, onRegister, onManage, canManage }: Props) {
  const typeMeta   = EVENT_TYPE_META[event.type];
  const statusMeta = EVENT_STATUS_META[event.status];
  const days       = daysUntil(event.eventDate);
  const isReg      = !!event.myParticipation;
  const isFull     = event.maxParticipants != null &&
                     event.participantsCount >= event.maxParticipants;

  return (
    <div
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
      onClick={() => onView(event)}
    >
      {/* Rang strip */}
      <div className={`h-1.5 ${typeMeta.bg.replace('bg-', 'bg-').replace('-50', '-300')}`} />

      <div className="p-4">
        {/* Sarlavha */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <typeMeta.icon size={22} className="shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{event.title}</h3>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-medium ${typeMeta.color}`}>{typeMeta.label}</span>
                {event.isOnline && (
                  <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-full">Onlayn</span>
                )}
              </div>
            </div>
          </div>
          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${statusMeta.bg} ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Ma'lumot */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span><Calendar size={16} /></span>
            <span>
              {formatLongDate(event.eventDate)} {formatTime(event.eventDate)}
            </span>
            {event.status === 'upcoming' && days > 0 && (
              <span className={`ml-1 font-medium ${days <= 3 ? 'text-red-600' : 'text-emerald-600'}`}>
                ({days} kun qoldi)
              </span>
            )}
          </div>
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span><MapPin size={16} /></span>
              <span className="truncate">{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{event.participantsCount}{event.maxParticipants ? `/${event.maxParticipants}` : ''} ishtirokchi</span>
            {event.hasFee && event.feeAmount && (
              <span>{event.feeAmount.toLocaleString()} so'm</span>
            )}
          </div>
        </div>

        {/* Tugmalar */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {canManage ? (
            <button
              onClick={() => onManage(event)}
              className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-xl font-medium transition-colors"
            >
              Boshqarish
            </button>
          ) : (
            isReg ? (
              <div className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl font-medium">
                Ro'yxatdan o'tildi
                {event.myParticipation?.permitQr && (
                  <a
                    href={event.myParticipation.permitQr}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    onClick={e => e.stopPropagation()}
                  >
                    QR
                  </a>
                )}
              </div>
            ) : (
              <button
                onClick={() => onRegister(event)}
                disabled={isFull || event.status !== 'upcoming'}
                className="flex-1 text-xs bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isFull ? 'To\'ldi' : '+ Ro\'yxatdan o\'tish'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

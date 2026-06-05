'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { EVENT_TYPE_META, EVENT_STATUS_META } from '@/types/events';
import type { CrmEvent, EventParticipant } from '@/types/events';

interface Props {
  event:   CrmEvent;
  onClose: () => void;
}

type Tab = 'participants' | 'qr' | 'certificates';

export default function ParticipantsModal({ event, onClose }: Props) {
  const qc    = useQueryClient();
  const [tab, setTab] = useState<Tab>('participants');
  const [selectedQr, setSelectedQr] = useState<EventParticipant | null>(null);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['event-participants', event.id],
    queryFn:  () => api.get<EventParticipant[]>(`/events/${event.id}/participants`).then(r => r.data),
  });

  const payMut = useMutation({
    mutationFn: (participantId: string) =>
      api.patch(`/events/participants/${participantId}/pay`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-participants', event.id] }),
  });

  const certMut = useMutation({
    mutationFn: ({ participantId, rank }: { participantId: string; rank: number }) =>
      api.post(`/events/participants/${participantId}/certificate`, { rank }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-participants', event.id] }),
  });

  const removeMut = useMutation({
    mutationFn: (participantId: string) =>
      api.delete(`/events/participants/${participantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-participants', event.id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const typeMeta   = EVENT_TYPE_META[event.type];
  const statusMeta = EVENT_STATUS_META[event.status];

  const paid   = participants.filter(p => p.hasPaid).length;
  const unpaid = participants.filter(p => !p.hasPaid && event.hasFee).length;
  const certs  = participants.filter(p => p.certificateUrl).length;

  // Barcha ishtirokchilarga sertifikat
  async function sendAllCerts() {
    if (!confirm("Barcha ishtirokchilarga sertifikat yuborilsinmi?")) return;
    for (const p of participants.filter(pp => !pp.certificateUrl)) {
      await certMut.mutateAsync({ participantId: p.id, rank: p.rank ?? 999 });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">{typeMeta.icon}</span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{event.title}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
                <span className="text-gray-300 text-[10px]">·</span>
                <span className="text-[10px] text-gray-400">{participants.length} ishtirokchi</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors">✕</button>
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-600">{paid} to'lagan</span>
          </div>
          {event.hasFee && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-gray-600">{unpaid} to'lamagan</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-gray-600">{certs} sertifikat</span>
          </div>
        </div>

        {/* Tab navigatsiya */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {([
            { id: 'participants', label: 'Ishtirokchilar', icon: '👥' },
            { id: 'qr',          label: 'QR Ruxsatnoma', icon: '📲' },
            { id: 'certificates',label: 'Sertifikatlar',  icon: '🏅' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : tab === 'participants' ? (
            <div className="space-y-2">
              {participants.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Ishtirokchilar yo'q</p>
              ) : (
                participants.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                      {p.user ? `${p.user.firstName[0]}${p.user.lastName[0]}` : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Noma\'lum'}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {p.user?.phone ?? ''}
                        {p.rank != null && ` · ${p.rank}-o'rin`}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {event.hasFee && (
                        p.hasPaid ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">✅ To'lagan</span>
                        ) : (
                          <button
                            onClick={() => payMut.mutate(p.id)}
                            disabled={payMut.isPending}
                            className="text-[10px] text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full font-medium transition-colors"
                          >
                            💳 To'latish
                          </button>
                        )
                      )}
                      <button
                        onClick={() => confirm("O'chirishni tasdiqlaysizmi?") && removeMut.mutate(p.id)}
                        className="text-gray-400 hover:text-red-500 text-xs w-6 h-6 rounded flex items-center justify-center transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : tab === 'qr' ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Ishtirokchining QR ruxsatnomasini ko'rish uchun bosing</p>
              <div className="grid grid-cols-2 gap-2">
                {participants.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedQr(selectedQr?.id === p.id ? null : p)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                      selectedQr?.id === p.id
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                      {p.user ? `${p.user.firstName[0]}${p.user.lastName[0]}` : '?'}
                    </div>
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Noma\'lum'}
                    </span>
                  </button>
                ))}
              </div>

              {selectedQr && (
                <div className="mt-4 flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {selectedQr.user ? `${selectedQr.user.firstName} ${selectedQr.user.lastName}` : ''}
                  </h3>
                  {selectedQr.permissionQrUrl ? (
                    <>
                      <img
                        src={selectedQr.permissionQrUrl}
                        alt="QR ruxsatnoma"
                        className="w-48 h-48 rounded-xl"
                      />
                      <a
                        href={selectedQr.permissionQrUrl}
                        download
                        className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-xl font-medium transition-colors"
                      >
                        ⬇️ Yuklab olish
                      </a>
                    </>
                  ) : (
                    <div className="text-center text-sm text-gray-400">
                      <div className="text-3xl mb-2">📲</div>
                      <p>QR ruxsatnoma hali yaratilmagan</p>
                      <button
                        onClick={() => api.post(`/events/participants/${selectedQr.id}/generate-qr`).then(() => qc.invalidateQueries({ queryKey: ['event-participants', event.id] }))}
                        className="mt-2 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-xl font-medium transition-colors"
                      >
                        QR yaratish
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Sertifikatlar */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {certs}/{participants.length} sertifikat yuborilgan
                </p>
                {event.status === 'completed' && (
                  <button
                    onClick={sendAllCerts}
                    disabled={certMut.isPending}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    📤 Barcha sertifikatlarni yuborish
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                    {/* O'rin */}
                    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-gray-200 text-gray-700' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.rank ?? i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Noma\'lum'}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {p.certificateUrl ? (
                        <a
                          href={p.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium"
                        >
                          🏅 Ko'rish
                        </a>
                      ) : (
                        <button
                          onClick={() => certMut.mutate({ participantId: p.id, rank: p.rank ?? i + 1 })}
                          disabled={certMut.isPending}
                          className="text-[10px] text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full font-medium transition-colors"
                        >
                          📤 Yuborish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

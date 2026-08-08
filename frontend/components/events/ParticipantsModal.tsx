'use client';

import { Download, HelpCircle, Medal, QrCode, Trash2, Trophy, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { EVENT_TYPE_META, EVENT_STATUS_META } from '@/types/events';
import type { CrmEvent, EventParticipant, Certificate } from '@/types/events';
import QuestionsTab from './QuestionsTab';
import LeaderboardPanel from './LeaderboardPanel';

interface Props {
  event:   CrmEvent;
  onClose: () => void;
}

type Tab = 'participants' | 'qr' | 'certificates' | 'questions' | 'leaderboard';

function studentName(p: EventParticipant): string {
  return p.student ? `${p.student.firstName} ${p.student.lastName}` : 'Noma\'lum';
}
function studentInitials(p: EventParticipant): string {
  return p.student ? `${p.student.firstName[0]}${p.student.lastName[0]}` : '?';
}

export default function ParticipantsModal({ event, onClose }: Props) {
  const qc    = useQueryClient();
  const [tab, setTab] = useState<Tab>('participants');
  const [selectedQr, setSelectedQr] = useState<EventParticipant | null>(null);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['event-participants', event.id],
    // Backend { data, total } shaklida javob beradi — bare array emas
    queryFn:  () => api.get<{ data: EventParticipant[]; total: number }>(`/events/${event.id}/participants`, { params: { limit: 100 } }).then(r => r.data.data),
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ['event-certificates', event.id],
    queryFn:  () => api.get<Certificate[]>(`/events/${event.id}/certificates`).then(r => r.data),
    enabled:  tab === 'certificates',
  });
  const certByStudent = new Map(certificates.map(c => [c.studentId, c]));

  const payMut = useMutation({
    mutationFn: (participantId: string) =>
      api.patch(`/events/${event.id}/participants/${participantId}`, { paymentStatus: 'paid' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-participants', event.id] }),
  });

  const removeMut = useMutation({
    mutationFn: (participantId: string) =>
      api.delete(`/events/${event.id}/participants/${participantId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-participants', event.id] });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      alert(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const generateCertsMut = useMutation({
    mutationFn: () => api.post<{ generated: number; skipped: number }>(`/events/${event.id}/certificates/generate`, { sendNotification: true }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['event-certificates', event.id] });
      alert(`${res.data.generated} ta sertifikat yaratildi${res.data.skipped ? `, ${res.data.skipped} ta o'tkazib yuborildi` : ''}`);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      alert(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const startMut = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/competition/start`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      alert(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const finishMut = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/competition/finish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      alert(e?.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  const typeMeta   = EVENT_TYPE_META[event.type];
  const statusMeta = EVENT_STATUS_META[event.status];

  const paid   = participants.filter(p => p.paymentStatus !== 'pending').length;
  const unpaid = participants.filter(p => p.paymentStatus === 'pending').length;
  const certs  = certByStudent.size;

  // Onlayn musobaqada sertifikat faqat yakunlangach yaratiladi (backend shart)
  const canGenerateCerts = !event.isOnline || event.competitionStatus === 'finished';

  const rankedParticipants = [...participants].sort((a, b) => {
    if (a.place == null && b.place == null) return 0;
    if (a.place == null) return 1;
    if (b.place == null) return -1;
    return a.place - b.place;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <typeMeta.icon size={22} className="shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">{event.title}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium ${statusMeta.color}`}>{statusMeta.label}</span>
                <span className="text-gray-300 text-[10px]">·</span>
                <span className="text-[10px] text-gray-400">{participants.length} ishtirokchi</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"><X size={16} /></button>
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

        {/* Musobaqa boshqarish */}
        {event.isOnline && (
          <div className="flex items-center justify-between gap-3 px-6 py-3 bg-indigo-50/60 border-b border-gray-100 shrink-0">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              event.competitionStatus === 'ongoing'  ? 'bg-emerald-100 text-emerald-700' :
              event.competitionStatus === 'finished' ? 'bg-gray-200 text-gray-600' :
              'bg-indigo-100 text-indigo-700'
            }`}>
              {event.competitionStatus === 'ongoing'  ? 'Musobaqa: davom etmoqda' :
               event.competitionStatus === 'finished' ? 'Musobaqa: yakunlangan' :
               'Musobaqa: boshlanmagan'}
            </span>

            {event.competitionStatus === 'not_started' && (
              <button
                onClick={() => startMut.mutate()}
                disabled={startMut.isPending}
                className="text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {startMut.isPending ? 'Boshlanmoqda...' : 'Musobaqani boshlash'}
              </button>
            )}
            {event.competitionStatus === 'ongoing' && (
              <button
                onClick={() => confirm("Musobaqani yakunlashni tasdiqlaysizmi? Bu amalni qaytarib bo'lmaydi.") && finishMut.mutate()}
                disabled={finishMut.isPending}
                className="text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {finishMut.isPending ? 'Yakunlanmoqda...' : 'Yakunlash'}
              </button>
            )}
          </div>
        )}

        {event.competitionStatus === 'finished' && event.results && (
          <div className="px-6 py-3 bg-amber-50 border-b border-gray-100 shrink-0">
            <p className="text-xs font-semibold text-amber-800 mb-1.5">G'oliblar</p>
            <div className="flex flex-wrap gap-1.5">
              {event.results.winners.map(w => (
                <span key={`${w.place}-${w.name}`} className="text-xs bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-amber-900">
                  {w.place}. {w.name} — {w.score} ball
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab navigatsiya */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {([
            { id: 'participants', label: 'Ishtirokchilar', icon: Users },
            { id: 'qr',          label: 'QR Ruxsatnoma', icon: QrCode },
            { id: 'certificates',label: 'Sertifikatlar',  icon: Medal },
            ...(event.isOnline ? [{ id: 'questions', label: 'Savollar', icon: HelpCircle }] as const : []),
            ...(event.isOnline && event.competitionStatus !== 'not_started'
              ? [{ id: 'leaderboard', label: 'Reyting', icon: Trophy }] as const
              : []),
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
              <t.icon size={14} className="shrink-0" /> {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'questions' ? (
            <QuestionsTab event={event} />
          ) : tab === 'leaderboard' ? (
            <LeaderboardPanel eventId={event.id} live={event.competitionStatus === 'ongoing'} />
          ) : isLoading ? (
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
                      {studentInitials(p)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{studentName(p)}</p>
                      <p className="text-[10px] text-gray-400">
                        {p.student?.phone ?? ''}
                        {p.place != null && ` · ${p.place}-o'rin`}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {event.hasFee && (
                        p.paymentStatus !== 'pending' ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">To'lagan</span>
                        ) : (
                          <button
                            onClick={() => payMut.mutate(p.id)}
                            disabled={payMut.isPending}
                            className="text-[10px] text-red-600 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full font-medium transition-colors"
                          >
                            To'latish
                          </button>
                        )
                      )}
                      <button
                        onClick={() => confirm("O'chirishni tasdiqlaysizmi?") && removeMut.mutate(p.id)}
                        className="text-gray-400 hover:text-red-500 text-xs w-6 h-6 rounded flex items-center justify-center transition-colors"
                      ><Trash2 size={16} /></button>
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
                      {studentInitials(p)}
                    </div>
                    <span className="text-xs font-medium text-gray-900 truncate">{studentName(p)}</span>
                  </button>
                ))}
              </div>

              {selectedQr && (
                <div className="mt-4 flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-2xl">
                  <h3 className="text-sm font-semibold text-gray-900">{studentName(selectedQr)}</h3>
                  {selectedQr.permitQr ? (
                    <>
                      <img
                        src={selectedQr.permitQr}
                        alt="QR ruxsatnoma"
                        className="w-48 h-48 rounded-xl"
                      />
                      <p className="text-[10px] text-gray-400">
                        {selectedQr.permitVerified ? "Tekshirilgan (kirgan)" : "Hali tekshirilmagan"}
                      </p>
                      <a
                        href={selectedQr.permitQr}
                        download={`ruxsatnoma-${selectedQr.permitCode ?? selectedQr.id}.png`}
                        className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-xl font-medium transition-colors"
                      >
                        <Download size={12} className="inline" /> Yuklab olish
                      </a>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 py-4">QR ruxsatnoma topilmadi</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Sertifikatlar */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  {certs}/{participants.length} sertifikat yaratilgan
                </p>
                {canGenerateCerts ? (
                  <button
                    onClick={() => confirm("Barcha ishtirokchilar uchun sertifikat yaratilsinmi? (Allaqachon borlar o'tkazib yuboriladi)") && generateCertsMut.mutate()}
                    disabled={generateCertsMut.isPending}
                    className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {generateCertsMut.isPending ? 'Yaratilmoqda...' : 'Barcha sertifikatlarni yaratish'}
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400">Musobaqa yakunlangach yaratiladi</span>
                )}
              </div>

              <div className="space-y-2">
                {rankedParticipants.map(p => {
                  const cert = certByStudent.get(p.studentId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                      <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        p.place === 1 ? 'bg-amber-100 text-amber-700' :
                        p.place === 2 ? 'bg-gray-200 text-gray-700' :
                        p.place === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {p.place ?? '–'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{studentName(p)}</p>
                      </div>

                      <div className="shrink-0">
                        {cert?.fileUrl ? (
                          <a
                            href={cert.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium"
                          >
                            Ko'rish
                          </a>
                        ) : (
                          <span className="text-[10px] text-gray-300">Yo'q</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

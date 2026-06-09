'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { QrData } from '@/types/attendance';

interface Props {
  lessonId: string;
  connected: boolean;
}

function getSecondsLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function fmtCountdown(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}s ${m}d`;
  if (m > 0) return `${m}d ${sec}s`;
  return `${sec}s`;
}

export default function QrCodeCard({ lessonId, connected }: Props) {
  const qc = useQueryClient();

  const { data: qr, isLoading } = useQuery({
    queryKey: ['lesson-qr', lessonId],
    queryFn:  () => api.get<QrData>(`/lessons/${lessonId}/qr`).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const refreshMut = useMutation({
    mutationFn: () => api.post<QrData>(`/lessons/${lessonId}/qr/refresh`).then(r => r.data),
    onSuccess:  (data) => qc.setQueryData(['lesson-qr', lessonId], data),
  });

  // Countdown
  const [secondsLeft, setSecondsLeft] = useState(() =>
    getSecondsLeft(qr?.qrPayload?.expiresAt ?? null),
  );

  useEffect(() => {
    setSecondsLeft(getSecondsLeft(qr?.qrPayload?.expiresAt ?? null));
  }, [qr]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const expirePct = qr?.qrPayload?.expiresAt
    ? Math.round((secondsLeft / 86400) * 100)
    : 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-4">
      {/* Real-time indikator */}
      <div className="flex items-center justify-between w-full">
        <h3 className="text-sm font-semibold text-gray-700">📱 QR Davomat</h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-400">{connected ? 'Real-time' : 'Offline'}</span>
        </div>
      </div>

      {/* QR rasm */}
      {isLoading ? (
        <div className="w-48 h-48 bg-gray-100 rounded-xl animate-pulse" />
      ) : qr?.qrImage ? (
        <div className="relative">
          <Image
            src={qr.qrImage}
            alt="QR kod"
            width={192}
            height={192}
            className="rounded-xl border-2 border-gray-100"
            unoptimized
          />
          {secondsLeft < 300 && secondsLeft > 0 && (
            <div className="absolute inset-0 bg-amber-500/10 rounded-xl border-2 border-amber-400 flex items-center justify-center">
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                ⚠️ {fmtCountdown(secondsLeft)}
              </span>
            </div>
          )}
          {secondsLeft === 0 && (
            <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
              <span className="text-white text-xs font-bold">Muddati o'tdi</span>
            </div>
          )}
        </div>
      ) : (
        <div className="w-48 h-48 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 text-sm">
          QR mavjud emas
        </div>
      )}

      {/* Countdown bar */}
      {qr && (
        <div className="w-full space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Muddati:</span>
            <span className={secondsLeft < 3600 ? 'text-amber-600 font-medium' : ''}>
              {secondsLeft > 0 ? fmtCountdown(secondsLeft) : 'O\'tdi'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${expirePct > 20 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${expirePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Yangilash tugmasi */}
      <button
        onClick={() => refreshMut.mutate()}
        disabled={refreshMut.isPending}
        className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {refreshMut.isPending ? (
          <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        ) : '🔄'}
        QR yangilash
      </button>
    </div>
  );
}

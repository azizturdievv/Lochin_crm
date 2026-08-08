'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { TwoFaSetupResponse } from '@/types';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

export default function TwoFaSetupModal({ onClose, onSuccess }: Props) {
  const [code,  setCode]  = useState('');
  const [error, setError] = useState('');

  const { data: setup, isLoading, isError } = useQuery({
    queryKey: ['2fa-setup'],
    queryFn:  () => api.get<TwoFaSetupResponse>('/auth/2fa/setup').then(r => r.data),
  });

  const confirmMut = useMutation({
    mutationFn: () => api.post('/auth/2fa/confirm', { code }).then(r => r.data),
    onSuccess:  () => onSuccess(),
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      setError(e?.response?.data?.message ?? 'Kod noto\'g\'ri'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (code.length !== 6) return setError('6 xonali kod kiriting');
    confirmMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">2FA sozlash</h2>
            <p className="text-xs text-gray-400 mt-0.5">Google Authenticator orqali</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <p className="text-sm text-red-600 text-center py-4">QR kod yuklanmadi. Qayta urinib ko&apos;ring.</p>
          ) : (
            <>
              <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                <li>Google Authenticator (yoki boshqa TOTP) ilovasini oching</li>
                <li>QR kodni skanerlang</li>
                <li>Ilovada chiqqan 6 xonali kodni pastga kiriting</li>
              </ol>

              <div className="flex justify-center py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup?.qrCodeDataUrl} alt="2FA QR kod" className="w-48 h-48 rounded-xl border border-gray-100" />
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-1">QR skanerlanmasa, qo&apos;lda kiriting:</p>
                <p className="text-xs font-mono text-gray-700 break-all select-all">{setup?.secret}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-2xl tracking-widest font-mono"
                />
                {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={confirmMut.isPending}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {confirmMut.isPending ? 'Tekshirilyapti...' : 'Tasdiqlash va yoqish'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

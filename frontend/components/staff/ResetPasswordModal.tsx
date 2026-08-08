'use client';

import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import type { StaffMember } from '@/types/staff';

interface Props {
  staff:   StaffMember;
  onClose: () => void;
}

export default function ResetPasswordModal({ staff, onClose }: Props) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);

  const mut = useMutation({
    mutationFn: () => api.post(`/users/${staff.id}/reset-password`, { newPassword: password }),
    onSuccess: () => setSuccess(true),
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      setError(e.response?.data?.message ?? 'Xatolik yuz berdi'),
  });

  function handleSubmit() {
    setError('');
    if (password.length < 8) { setError('Parol kamida 8 ta belgi bo\'lishi kerak'); return; }
    if (password !== confirm) { setError('Parollar mos emas'); return; }
    mut.mutate();
  }

  // Tasodifiy kuchli parol yaratish
  function generatePassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!';
    const pwd   = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPassword(pwd);
    setConfirm(pwd);
    setShowPass(true);
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="text-5xl mb-4"><CheckCircle2 size={16} /></div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Parol tiklandi!</h2>
          <p className="text-sm text-gray-500 mb-6">
            {staff.firstName} {staff.lastName} ga yangi parol o'rnatildi.
          </p>
          <button onClick={onClose}
            className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors">
            Yopish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Parol tiklash</h2>
            <p className="text-xs text-gray-400 mt-0.5">{staff.firstName} {staff.lastName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Tasodifiy parol yaratish */}
          <button
            onClick={generatePassword}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-700 rounded-xl transition-colors"
          >
            Tasodifiy kuchli parol yaratish
          </button>

          {/* Yangi parol */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Yangi parol *</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Kamida 8 ta belgi"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                {showPass ? <EyeOff size={14} className="inline" /> : <Eye size={14} className="inline" />}
              </button>
            </div>
            {/* Kuch indikatori */}
            {password && (
              <div className="flex gap-1 mt-1.5">
                {[8, 10, 12].map((threshold, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                    password.length >= threshold
                      ? i === 0 ? 'bg-red-400' : i === 1 ? 'bg-amber-400' : 'bg-emerald-500'
                      : 'bg-gray-100'
                  }`} />
                ))}
                <span className="text-[10px] text-gray-400 ml-1">
                  {password.length < 8 ? 'Juda qisqa' : password.length < 10 ? 'O\'rtacha' : 'Kuchli'}
                </span>
              </div>
            )}
          </div>

          {/* Tasdiqlash */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Parolni tasdiqlang *</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Qayta kiriting"
              className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                confirm && confirm !== password
                  ? 'border-red-300 bg-red-50'
                  : confirm && confirm === password
                  ? 'border-emerald-300'
                  : 'border-gray-200'
              }`}
            />
            {confirm && confirm !== password && (
              <p className="text-red-500 text-[10px] mt-1">Parollar mos emas</p>
            )}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}

          {/* Tugmalar */}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Bekor
            </button>
            <button
              onClick={handleSubmit}
              disabled={mut.isPending || !password || password !== confirm}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl disabled:opacity-50 transition-colors"
            >
              {mut.isPending ? 'Tiklanmoqda...' : 'Tiklash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

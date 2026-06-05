'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Tab = 'profile' | 'security' | 'notifications' | 'system';

interface Profile {
  firstName:  string;
  lastName:   string;
  middleName: string;
  phone:      string;
  email:      string;
}

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'profile',       label: 'Profil',          icon: '👤' },
  { id: 'security',      label: 'Xavfsizlik',       icon: '🔒' },
  { id: 'notifications', label: 'Bildirishnomalar', icon: '🔔' },
  { id: 'system',        label: 'Tizim',            icon: '⚙️' },
];

const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

export default function SettingsPage() {
  const user  = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const qc    = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');

  // ── Profil holati ────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile>({
    firstName:  user?.firstName  ?? '',
    lastName:   user?.lastName   ?? '',
    middleName: '',
    phone:      '',
    email:      user?.email      ?? '',
  });
  const [profileMsg, setProfileMsg] = useState('');

  // ── Parol holati ─────────────────────────────────────────────────────────
  const [oldPass,   setOldPass]   = useState('');
  const [newPass,   setNewPass]   = useState('');
  const [confPass,  setConfPass]  = useState('');
  const [passMsg,   setPassMsg]   = useState('');
  const [showPass,  setShowPass]  = useState(false);

  // ── Bildirishnoma holati ─────────────────────────────────────────────────
  const [notifSms,     setNotifSms]     = useState(true);
  const [notifTelegram,setNotifTelegram]= useState(true);
  const [notifPush,    setNotifPush]    = useState(true);

  // ── Mutatsiyalar ─────────────────────────────────────────────────────────
  const profileMut = useMutation({
    mutationFn: () => api.patch(`/users/${user?.id}`, {
      firstName:  profile.firstName,
      lastName:   profile.lastName,
      phone:      profile.phone || undefined,
    }),
    onSuccess: (res) => {
      setProfileMsg('✅ Profil yangilandi');
      if (user) setUser({ ...user, firstName: profile.firstName, lastName: profile.lastName });
      setTimeout(() => setProfileMsg(''), 3000);
    },
    onError: () => setProfileMsg('❌ Xatolik yuz berdi'),
  });

  const passMut = useMutation({
    mutationFn: () => api.post('/auth/change-password', { oldPassword: oldPass, newPassword: newPass }),
    onSuccess: () => {
      setPassMsg('✅ Parol o\'zgartirildi');
      setOldPass(''); setNewPass(''); setConfPass('');
      setTimeout(() => setPassMsg(''), 3000);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setPassMsg(`❌ ${e.response?.data?.message ?? 'Xatolik'}`),
  });

  function handlePassSubmit() {
    setPassMsg('');
    if (!oldPass) { setPassMsg('❌ Eski parol kiritilishi shart'); return; }
    if (newPass.length < 8) { setPassMsg('❌ Yangi parol kamida 8 ta belgi'); return; }
    if (newPass !== confPass) { setPassMsg('❌ Parollar mos emas'); return; }
    passMut.mutate();
  }

  const passStrength = newPass.length === 0 ? 0 : newPass.length < 8 ? 1 : newPass.length < 12 ? 2 : 3;

  return (
    <div className="flex flex-col h-full">
      {/* Sarlavha */}
      <div className="px-6 pt-6 pb-0 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-gray-600 flex items-center justify-center text-white text-xl shrink-0">⚙️</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Sozlamalar</h1>
            <p className="text-xs text-gray-400">Profil va tizim sozlamalari</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl space-y-5">

          {/* ── PROFIL TAB ─── */}
          {tab === 'profile' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">👤 Shaxsiy ma'lumotlar</h2>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700 shrink-0">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-400">{user?.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Ism</label>
                  <input
                    className={INPUT}
                    value={profile.firstName}
                    onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Familiya</label>
                  <input
                    className={INPUT}
                    value={profile.lastName}
                    onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL}>Telefon</label>
                <input
                  className={INPUT}
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+998901234567"
                />
              </div>

              <div>
                <label className={LABEL}>Email (o'zgartirib bo'lmaydi)</label>
                <input className={INPUT + ' bg-gray-50 text-gray-400 cursor-not-allowed'} value={profile.email} readOnly />
              </div>

              {profileMsg && <p className="text-sm">{profileMsg}</p>}

              <button
                onClick={() => profileMut.mutate()}
                disabled={profileMut.isPending}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {profileMut.isPending ? 'Saqlanmoqda...' : '💾 Saqlash'}
              </button>
            </div>
          )}

          {/* ── XAVFSIZLIK TAB ─── */}
          {tab === 'security' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">🔑 Parol o'zgartirish</h2>

                <div>
                  <label className={LABEL}>Eski parol</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={oldPass}
                      onChange={e => setOldPass(e.target.value)}
                      className={INPUT + ' pr-10'}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? '🙈' : '👁'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={LABEL}>Yangi parol</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    className={INPUT}
                    placeholder="Kamida 8 ta belgi"
                  />
                  {/* Kuch indikatori */}
                  {newPass && (
                    <div className="flex gap-1 mt-1.5 items-center">
                      {[1,2,3].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${
                          passStrength >= i
                            ? i === 1 ? 'bg-red-400' : i === 2 ? 'bg-amber-400' : 'bg-emerald-500'
                            : 'bg-gray-100'
                        }`} />
                      ))}
                      <span className="text-[10px] text-gray-400 ml-1">
                        {passStrength === 1 ? 'Zaif' : passStrength === 2 ? "O'rtacha" : 'Kuchli'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={LABEL}>Tasdiqlash</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confPass}
                    onChange={e => setConfPass(e.target.value)}
                    className={`${INPUT} ${confPass && confPass !== newPass ? 'border-red-300' : ''}`}
                    placeholder="Qayta kiriting"
                  />
                  {confPass && confPass !== newPass && (
                    <p className="text-red-500 text-[10px] mt-1">Parollar mos emas</p>
                  )}
                </div>

                {passMsg && <p className="text-sm">{passMsg}</p>}

                <button
                  onClick={handlePassSubmit}
                  disabled={passMut.isPending}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
                >
                  {passMut.isPending ? "O'zgartirilyapti..." : '🔑 Parolni o\'zgartirish'}
                </button>
              </div>

              {/* 2FA holati */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">🔐 Ikki faktorli autentifikatsiya</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {user?.role === 'super_admin' || user?.role === 'manager'
                        ? 'SA va Manager uchun MAJBURIY'
                        : 'Ixtiyoriy xavfsizlik qatlami'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    Yoqilmagan
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  2FA sozlash uchun Super Admin bilan bog'laning yoki /api/v1/auth/2fa/setup endpointidan foydalaning.
                </p>
              </div>
            </div>
          )}

          {/* ── BILDIRISHNOMALAR TAB ─── */}
          {tab === 'notifications' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">🔔 Bildirishnoma sozlamalari</h2>

              {[
                { label: 'SMS bildirishnomalar',      sub: 'Davomat, to\'lov eslatma, test natijasi', val: notifSms,      set: setNotifSms     },
                { label: 'Telegram bildirishnomalar', sub: 'Bot orqali xabarlar',                    val: notifTelegram, set: setNotifTelegram },
                { label: 'Push bildirishnomalar',     sub: 'Ilovadagi bildirishnomalar',              val: notifPush,     set: setNotifPush     },
              ].map(item => (
                <label key={item.label} className="flex items-center justify-between cursor-pointer py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.sub}</p>
                  </div>
                  <button
                    onClick={() => item.set(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      item.val ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      item.val ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </label>
              ))}

              <button className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors">
                💾 Saqlash
              </button>
            </div>
          )}

          {/* ── TIZIM TAB (faqat SA) ─── */}
          {tab === 'system' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">⚙️ Tizim ma'lumotlari</h2>

                {[
                  { label: 'Versiya',        value: 'v1.0.0'           },
                  { label: 'Backend',        value: 'NestJS + TypeScript' },
                  { label: "Ma'lumotlar bazasi", value: 'PostgreSQL 16' },
                  { label: 'Kesh',           value: 'Redis 7'           },
                  { label: 'Fayl saqlash',   value: 'MinIO'             },
                ].map(row => (
                  <div key={row.label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className="text-xs font-medium text-gray-900">{row.value}</span>
                  </div>
                ))}
              </div>

              {user?.role === 'super_admin' && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 space-y-3">
                  <h2 className="text-sm font-semibold text-red-800">⚠️ Xavfli zonа</h2>
                  <p className="text-xs text-red-600">
                    Bu amallar qaytarib bo'lmaydi. Ehtiyotkorlik bilan bajaring.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => confirm("Keshni tozalashni tasdiqlaysizmi?") && api.post('/admin/cache/clear').catch(() => {})}
                      className="w-full py-2 text-sm text-red-700 border border-red-200 hover:bg-red-100 rounded-xl transition-colors"
                    >
                      🗑️ Keshni tozalash
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

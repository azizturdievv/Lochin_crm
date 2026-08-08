'use client';

import { Bell, Clock, Eye, EyeOff, Lock, Pencil, School, Settings, ShieldCheck, Trash2, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import PermissionsMatrixTab from '@/components/settings/PermissionsMatrixTab';
import TwoFaSetupModal from '@/components/settings/TwoFaSetupModal';

type Tab = 'profile' | 'security' | 'notifications' | 'system' | 'time_slots' | 'rooms' | 'permissions';

// ─── JADVAL SOZLAMA TURLARI ───────────────────────────────────────────────────
interface TimeSlot {
  id: string; name: string; startTime: string; endTime: string;
  isActive: boolean; orderIndex: number;
}
interface Room {
  id: string; name: string; number: string; capacity: number;
  isActive: boolean; orderIndex: number;
}

interface Profile {
  firstName:  string;
  lastName:   string;
  middleName: string;
  phone:      string;
  email:      string;
}

const BASE_TABS: Array<{ id: Tab; label: string; icon: LucideIcon; adminOnly?: boolean }> = [
  { id: 'profile',       label: 'Profil',          icon: User },
  { id: 'security',      label: 'Xavfsizlik',       icon: Lock },
  { id: 'notifications', label: 'Bildirishnomalar', icon: Bell },
  { id: 'time_slots',    label: 'Paralar',          icon: Clock, adminOnly: true },
  { id: 'rooms',         label: 'Xonalar',          icon: School, adminOnly: true },
  { id: 'permissions',   label: 'Ruxsatlar',        icon: ShieldCheck, adminOnly: true },
  { id: 'system',        label: 'Tizim',            icon: Settings, adminOnly: true },
];

const INPUT = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500';
const LABEL = 'text-xs font-medium text-gray-600 mb-1 block';

export default function SettingsPage() {
  const user  = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const qc    = useQueryClient();
  const [tab, setTab] = useState<Tab>('profile');
  const [show2fa, setShow2fa] = useState(false);
  const isSA  = user?.role === 'super_admin';
  const TABS  = BASE_TABS.filter(t => !t.adminOnly || isSA);

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

  // ── Paralar holati ───────────────────────────────────────────────────────
  const [slotForm, setSlotForm] = useState({ name:'', startTime:'', endTime:'', orderIndex: 0 });
  const [editSlot, setEditSlot] = useState<TimeSlot | null>(null);

  const { data: timeSlots, refetch: refetchSlots } = useQuery({
    queryKey: ['time-slots-settings'],
    queryFn:  () => api.get<TimeSlot[]>('/schedule/time-slots').then(r => r.data),
    enabled:  isSA,
  });

  const createSlotMut = useMutation({
    mutationFn: (d: typeof slotForm) => api.post('/schedule/time-slots', d),
    onSuccess:  () => { refetchSlots(); setSlotForm({ name:'', startTime:'', endTime:'', orderIndex: 0 }); },
  });
  const updateSlotMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<TimeSlot> }) =>
      api.patch(`/schedule/time-slots/${id}`, d),
    onSuccess: () => { refetchSlots(); setEditSlot(null); qc.invalidateQueries({ queryKey: ['time-slots'] }); },
  });
  const deleteSlotMut = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/time-slots/${id}`),
    onSuccess:  () => { refetchSlots(); qc.invalidateQueries({ queryKey: ['time-slots'] }); },
  });

  // ── Xonalar holati ────────────────────────────────────────────────────────
  const [roomForm, setRoomForm] = useState({ name:'', number:'', capacity: 20, orderIndex: 0 });
  const [editRoom, setEditRoom] = useState<Room | null>(null);

  const { data: rooms, refetch: refetchRooms } = useQuery({
    queryKey: ['rooms-settings'],
    queryFn:  () => api.get<Room[]>('/schedule/rooms').then(r => r.data),
    enabled:  isSA,
  });

  const createRoomMut = useMutation({
    mutationFn: (d: typeof roomForm) => api.post('/schedule/rooms', d),
    onSuccess:  () => { refetchRooms(); setRoomForm({ name:'', number:'', capacity: 20, orderIndex: 0 }); },
  });
  const updateRoomMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Room> }) =>
      api.patch(`/schedule/rooms/${id}`, d),
    onSuccess: () => { refetchRooms(); setEditRoom(null); qc.invalidateQueries({ queryKey: ['rooms'] }); },
  });
  const deleteRoomMut = useMutation({
    mutationFn: (id: string) => api.delete(`/schedule/rooms/${id}`),
    onSuccess:  () => { refetchRooms(); qc.invalidateQueries({ queryKey: ['rooms'] }); },
  });

  // ── Mutatsiyalar ─────────────────────────────────────────────────────────
  const profileMut = useMutation({
    mutationFn: () => api.patch(`/users/${user?.id}`, {
      firstName:  profile.firstName,
      lastName:   profile.lastName,
      phone:      profile.phone || undefined,
    }),
    onSuccess: (res) => {
      setProfileMsg('Profil yangilandi');
      if (user) setUser({ ...user, firstName: profile.firstName, lastName: profile.lastName });
      setTimeout(() => setProfileMsg(''), 3000);
    },
    onError: () => setProfileMsg('Xatolik yuz berdi'),
  });

  const passMut = useMutation({
    mutationFn: () => api.post('/auth/change-password', { oldPassword: oldPass, newPassword: newPass }),
    onSuccess: () => {
      setPassMsg('Parol o\'zgartirildi');
      setOldPass(''); setNewPass(''); setConfPass('');
      setTimeout(() => setPassMsg(''), 3000);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setPassMsg(`${e.response?.data?.message ?? 'Xatolik'}`),
  });

  function handlePassSubmit() {
    setPassMsg('');
    if (!oldPass) { setPassMsg('Eski parol kiritilishi shart'); return; }
    if (newPass.length < 8) { setPassMsg('Yangi parol kamida 8 ta belgi'); return; }
    if (newPass !== confPass) { setPassMsg('Parollar mos emas'); return; }
    passMut.mutate();
  }

  const passStrength = newPass.length === 0 ? 0 : newPass.length < 8 ? 1 : newPass.length < 12 ? 2 : 3;

  return (
    <div className="flex flex-col h-full">
      {/* Sarlavha */}
      <div className="px-6 pt-6 pb-0 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-gray-600 flex items-center justify-center text-white text-xl shrink-0"><Settings size={16} /></div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Sozlamalar</h1>
            <p className="text-xs text-gray-400">Profil va tizim sozlamalari</p>
          </div>
        </div>

        {/* Tab nav */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                tab === t.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon size={14} className="shrink-0" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className={`space-y-5 ${tab === 'permissions' ? 'max-w-3xl' : 'max-w-xl'}`}>

          {/* ── PROFIL TAB ─── */}
          {tab === 'profile' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Shaxsiy ma'lumotlar</h2>

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
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {profileMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          )}

          {/* ── XAVFSIZLIK TAB ─── */}
          {tab === 'security' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-900">Parol o'zgartirish</h2>

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
                      {showPass ? <EyeOff size={14} className="inline" /> : <Eye size={14} className="inline" />}
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
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
                >
                  {passMut.isPending ? "O'zgartirilyapti..." : 'Parolni o\'zgartirish'}
                </button>
              </div>

              {/* 2FA holati */}
              <div className="bg-white border border-gray-100 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Ikki faktorli autentifikatsiya</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {user?.role === 'super_admin' || user?.role === 'manager'
                        ? 'SA va Manager uchun MAJBURIY'
                        : 'Ixtiyoriy xavfsizlik qatlami'}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    user?.twoFaEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {user?.twoFaEnabled ? 'Yoqilgan' : 'Yoqilmagan'}
                  </span>
                </div>
                {user?.twoFaEnabled ? (
                  <p className="text-xs text-emerald-600 mt-3">
                    Google Authenticator orqali himoyalangan. Har safar kirishda 6 xonali kod so'raladi.
                  </p>
                ) : (
                  <button
                    onClick={() => setShow2fa(true)}
                    className="w-full mt-3 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    2FA'ni yoqish
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── BILDIRISHNOMALAR TAB ─── */}
          {tab === 'notifications' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">Bildirishnoma sozlamalari</h2>

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

              <button className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors">
                Saqlash
              </button>
            </div>
          )}

          {/* ── PARALAR TAB ─── */}
          {tab === 'time_slots' && (
            <div className="space-y-4">
              {/* Yangi para qo'shish */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">⏰ Yangi para qo'shish</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Para nomi</label>
                    <input className={INPUT} value={slotForm.name}
                      onChange={e => setSlotForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="1-para" />
                  </div>
                  <div>
                    <label className={LABEL}>Tartib #</label>
                    <input className={INPUT} type="number" min={0}
                      value={slotForm.orderIndex}
                      onChange={e => setSlotForm(f => ({ ...f, orderIndex: +e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL}>Boshlanish</label>
                    <input className={INPUT} type="time" value={slotForm.startTime}
                      onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL}>Tugash</label>
                    <input className={INPUT} type="time" value={slotForm.endTime}
                      onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <button
                  onClick={() => createSlotMut.mutate(slotForm)}
                  disabled={createSlotMut.isPending || !slotForm.name || !slotForm.startTime || !slotForm.endTime}
                  className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {createSlotMut.isPending ? 'Saqlanmoqda...' : '+ Qo\'shish'}
                </button>
              </div>

              {/* Paralar ro'yxati */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Paralar ro'yxati</h3>
                  <span className="text-xs text-gray-400">{timeSlots?.length ?? 0} ta</span>
                </div>
                {!timeSlots?.length ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Hali paralar qo'shilmagan</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {timeSlots.map(slot => (
                      <div key={slot.id} className="px-5 py-3 flex items-center gap-3">
                        {editSlot?.id === slot.id ? (
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input className={INPUT} value={editSlot.name}
                              onChange={e => setEditSlot(s => s && ({ ...s, name: e.target.value }))}
                              placeholder="Nom" />
                            <input className={INPUT} type="number" min={0} value={editSlot.orderIndex}
                              onChange={e => setEditSlot(s => s && ({ ...s, orderIndex: +e.target.value }))} />
                            <input className={INPUT} type="time" value={editSlot.startTime}
                              onChange={e => setEditSlot(s => s && ({ ...s, startTime: e.target.value }))} />
                            <input className={INPUT} type="time" value={editSlot.endTime}
                              onChange={e => setEditSlot(s => s && ({ ...s, endTime: e.target.value }))} />
                            <button onClick={() => updateSlotMut.mutate({ id: slot.id, d: editSlot })}
                              disabled={updateSlotMut.isPending}
                              className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-xl hover:bg-primary-700 disabled:opacity-50">
                              Saqlash
                            </button>
                            <button onClick={() => setEditSlot(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50">
                              Bekor
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{slot.name}</p>
                              <p className="text-xs text-gray-400">{slot.startTime} – {slot.endTime}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${slot.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {slot.isActive ? 'Faol' : 'Nofaol'}
                            </span>
                            <button onClick={() => setEditSlot(slot)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-sm"><Pencil size={16} /></button>
                            <button onClick={() => { if (confirm('Para o\'chirilsinmi?')) deleteSlotMut.mutate(slot.id); }}
                              disabled={deleteSlotMut.isPending}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 text-sm disabled:opacity-50"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── XONALAR TAB ─── */}
          {tab === 'rooms' && (
            <div className="space-y-4">
              {/* Yangi xona qo'shish */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Yangi xona qo'shish</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>Xona nomi</label>
                    <input className={INPUT} value={roomForm.name}
                      onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Xona 101" />
                  </div>
                  <div>
                    <label className={LABEL}>Raqami (identifikator)</label>
                    <input className={INPUT} value={roomForm.number}
                      onChange={e => setRoomForm(f => ({ ...f, number: e.target.value }))}
                      placeholder="101" />
                  </div>
                  <div>
                    <label className={LABEL}>Sig'im (o'rinlar)</label>
                    <input className={INPUT} type="number" min={1} max={500}
                      value={roomForm.capacity}
                      onChange={e => setRoomForm(f => ({ ...f, capacity: +e.target.value }))} />
                  </div>
                  <div>
                    <label className={LABEL}>Tartib #</label>
                    <input className={INPUT} type="number" min={0}
                      value={roomForm.orderIndex}
                      onChange={e => setRoomForm(f => ({ ...f, orderIndex: +e.target.value }))} />
                  </div>
                </div>
                <button
                  onClick={() => createRoomMut.mutate(roomForm)}
                  disabled={createRoomMut.isPending || !roomForm.name || !roomForm.number}
                  className="w-full py-2.5 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {createRoomMut.isPending ? 'Saqlanmoqda...' : '+ Qo\'shish'}
                </button>
              </div>

              {/* Xonalar ro'yxati */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Xonalar ro'yxati</h3>
                  <span className="text-xs text-gray-400">{rooms?.length ?? 0} ta</span>
                </div>
                {!rooms?.length ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Hali xonalar qo'shilmagan</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {rooms.map(room => (
                      <div key={room.id} className="px-5 py-3 flex items-center gap-3">
                        {editRoom?.id === room.id ? (
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input className={INPUT} value={editRoom.name}
                              onChange={e => setEditRoom(r => r && ({ ...r, name: e.target.value }))}
                              placeholder="Xona nomi" />
                            <input className={INPUT} value={editRoom.number}
                              onChange={e => setEditRoom(r => r && ({ ...r, number: e.target.value }))}
                              placeholder="Raqam" />
                            <input className={INPUT} type="number" min={1} value={editRoom.capacity}
                              onChange={e => setEditRoom(r => r && ({ ...r, capacity: +e.target.value }))} />
                            <input className={INPUT} type="number" min={0} value={editRoom.orderIndex}
                              onChange={e => setEditRoom(r => r && ({ ...r, orderIndex: +e.target.value }))} />
                            <button onClick={() => updateRoomMut.mutate({ id: room.id, d: editRoom })}
                              disabled={updateRoomMut.isPending}
                              className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded-xl hover:bg-primary-700 disabled:opacity-50">
                              Saqlash
                            </button>
                            <button onClick={() => setEditRoom(null)}
                              className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-xl hover:bg-gray-50">
                              Bekor
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{room.name}</p>
                              <p className="text-xs text-gray-400">#{room.number} • {room.capacity} o'rin</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${room.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {room.isActive ? 'Faol' : 'Nofaol'}
                            </span>
                            <button onClick={() => setEditRoom(room)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-sm"><Pencil size={16} /></button>
                            <button onClick={() => { if (confirm('Xona o\'chirilsinmi?')) deleteRoomMut.mutate(room.id); }}
                              disabled={deleteRoomMut.isPending}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 text-sm disabled:opacity-50"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── RUXSATLAR TAB (faqat SA) ─── */}
          {tab === 'permissions' && <PermissionsMatrixTab />}

          {/* ── TIZIM TAB (faqat SA) ─── */}
          {tab === 'system' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Tizim ma'lumotlari</h2>

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
                  <h2 className="text-sm font-semibold text-red-800">Xavfli zona</h2>
                  <p className="text-xs text-red-600">
                    Bu amallar qaytarib bo'lmaydi. Ehtiyotkorlik bilan bajaring.
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() => confirm("Keshni tozalashni tasdiqlaysizmi?") && api.post('/admin/cache/clear').catch(() => {})}
                      className="w-full py-2 text-sm text-red-700 border border-red-200 hover:bg-red-100 rounded-xl transition-colors"
                    >
                      Keshni tozalash
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {show2fa && user && (
        <TwoFaSetupModal
          onClose={() => setShow2fa(false)}
          onSuccess={() => {
            setUser({ ...user, twoFaEnabled: true });
            setShow2fa(false);
          }}
        />
      )}
    </div>
  );
}

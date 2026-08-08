'use client';

import { Star } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

// ─── TIPLAR ───────────────────────────────────────────────────────────────────
interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  totalPoints: number;
  birthDate: string | null;
  address: string | null;
  schoolName: string | null;
  schoolGrade: number | null;
  referralSource: string | null;
  telegramChatId: string | null;
  twoFaEnabled: boolean;
  createdAt: string;
  // Student
  enrollments?: {
    id: string; groupId: string; groupName: string; subjectName: string;
    enrolledAt: string; discountPercent: number;
    attendance: { total: number; present: number; rate: number };
  }[];
  payments?: { totalPaid: number; lastPaymentAt: string | null; paidThisMonth: boolean };
  recentPoints?: { id: string; points: number; reason: string; createdAt: string }[];
  // Ustoz
  groups?: { id: string; name: string; subjectName: string; currentStudents: number; maxStudents: number }[];
  monthlyPoints?: number;
}

type Tab = 'main' | 'login' | 'extra';

const INPUT  = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition';
const LABEL  = 'block text-xs font-medium text-gray-600 mb-1.5';
const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', manager: 'Manager', ustoz: 'Ustoz', student: "O'quvchi",
};

type ApiErr = { response?: { data?: { message?: string | string[] } } };
function getMsg(err: unknown) {
  const m = (err as ApiErr)?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m ?? 'Xatolik yuz berdi';
}

// ─── ASOSIY SAHIFA ────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const qc      = useQueryClient();
  const setUser = useAuthStore(s => s.setUser);
  const user    = useAuthStore(s => s.user);
  const [tab, setTab] = useState<Tab>('main');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get<ProfileData>('/users/me/profile').then(r => r.data),
  });

  const updateMut = useMutation({
    mutationFn: (data: object) => api.patch('/users/profile', data).then(r => r.data),
    onSuccess: (updated: ProfileData) => {
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      setUser({ ...user!, firstName: updated.firstName, lastName: updated.lastName,
        email: updated.email, username: updated.username, avatarUrl: updated.avatarUrl });
    },
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: 'main',  label: 'Asosiy' },
    { key: 'login', label: 'Kirish' },
    { key: 'extra', label: 'Qo\'shimcha' },
  ];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* ── SARLAVHA ── */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">Mening profilim</h1>
        <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </span>
      </div>

      {/* ── AVATAR KARTA ── */}
      <AvatarCard profile={profile} onUpdated={() => qc.invalidateQueries({ queryKey: ['my-profile'] })} setUser={setUser} user={user} />

      {/* ── TABLAR ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 px-6">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`py-3.5 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'main'  && <MainTab  profile={profile} mut={updateMut} />}
          {tab === 'login' && <LoginTab profile={profile} mut={updateMut} />}
          {tab === 'extra' && <ExtraTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}

// ─── AVATAR KARTA ────────────────────────────────────────────────────────────
function AvatarCard({ profile, onUpdated, setUser, user }: {
  profile: ProfileData;
  onUpdated: () => void;
  setUser: (u: Parameters<typeof useAuthStore>[0] extends (s: infer S) => unknown ? S extends { user: infer U } ? Exclude<U, null> : never : never) => void;
  user: Parameters<typeof useAuthStore>[0] extends (s: infer S) => unknown ? S extends { user: infer U } ? U : never : never;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Tekshirish
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Faqat JPG, PNG, WebP rasmlari qabul qilinadi');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Fayl hajmi 2MB dan oshmasligi kerak');
      return;
    }

    setError('');
    // Preview ko'rsatish
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // Yuklash
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await api.post<{ avatarUrl: string }>('/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated();
    } catch (err) {
      setError(getMsg(err));
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const avatarSrc = preview ?? profile.avatarUrl;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-6">
      <div className="relative group shrink-0">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-emerald-100 flex items-center justify-center">
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-emerald-700">{initials}</span>
          )}
        </div>

        {/* Hover overlay */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
        >
          <span className="text-white text-xs font-medium">
            {uploading ? '⏳' : ''}
          </span>
        </button>

        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          className="hidden" onChange={handleFile} />
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-gray-900">
          {profile.lastName} {profile.firstName}
          {profile.middleName && ` ${profile.middleName}`}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {profile.username ? <span className="text-emerald-600 font-medium">@{profile.username}</span> : null}
          {profile.username && profile.email ? <span className="mx-2 text-gray-300">·</span> : null}
          {profile.email && <span>{profile.email}</span>}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-gray-400"><Star size={12} className="inline" /> {profile.totalPoints} ball</span>
          {profile.twoFaEnabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">2FA faol</span>}
          <span className="text-xs text-gray-400">
            {new Date(profile.createdAt).toLocaleDateString('uz-UZ')} dan a'zo
          </span>
        </div>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        <p className="text-xs text-gray-400 mt-1">Avatarni o'zgartirish uchun rasmga bosing (max 2MB, JPG/PNG)</p>
      </div>
    </div>
  );
}

// ─── ASOSIY TAB ──────────────────────────────────────────────────────────────
function MainTab({ profile, mut }: {
  profile: ProfileData;
  mut: ReturnType<typeof useMutation<ProfileData, unknown, object>>;
}) {
  // O'quvchi — bu ma'lumotlar enrollment yozuvi, faqat SA/Manager o'zgartira oladi
  if (profile.role === 'student') {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2.5 rounded-xl">
          Bu ma'lumotlarni faqat administrator o'zgartira oladi. O'zgartirish kerak bo'lsa, administratorga murojaat qiling.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Familiya" value={profile.lastName} />
          <ReadOnlyField label="Ism" value={profile.firstName} />
        </div>
        {profile.middleName && <ReadOnlyField label="Otasining ismi" value={profile.middleName} />}
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Telefon" value={profile.phone ?? '—'} />
          <ReadOnlyField label="Tug'ilgan sana" value={profile.birthDate ? new Date(profile.birthDate).toLocaleDateString('uz-UZ') : '—'} />
        </div>
        <ReadOnlyField label="Manzil" value={profile.address ?? '—'} />
        {(profile.schoolName || profile.schoolGrade) && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <ReadOnlyField label="Maktab nomi" value={profile.schoolName ?? '—'} />
            <ReadOnlyField label="Sinf" value={profile.schoolGrade ? `${profile.schoolGrade}-sinf` : '—'} />
          </div>
        )}
      </div>
    );
  }

  return <EditableMainTab profile={profile} mut={mut} />;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <div className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-100 rounded-xl text-gray-600">{value}</div>
    </div>
  );
}

function EditableMainTab({ profile, mut }: {
  profile: ProfileData;
  mut: ReturnType<typeof useMutation<ProfileData, unknown, object>>;
}) {
  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName:  profile.lastName,
    middleName:profile.middleName ?? '',
    phone:     profile.phone ?? '',
    birthDate: profile.birthDate ? profile.birthDate.slice(0, 10) : '',
    address:   profile.address ?? '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleSave() {
    mut.mutate({ ...form, birthDate: form.birthDate || undefined });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Familiya</label>
          <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>Ism</label>
          <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Otasining ismi</label>
        <input value={form.middleName} onChange={e => set('middleName', e.target.value)} className={INPUT} placeholder="Ixtiyoriy" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Telefon</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className={INPUT} placeholder="+998901234567" />
        </div>
        <div>
          <label className={LABEL}>Tug'ilgan sana</label>
          <input value={form.birthDate} onChange={e => set('birthDate', e.target.value)} type="date" className={INPUT} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Manzil</label>
        <input value={form.address} onChange={e => set('address', e.target.value)} className={INPUT} placeholder="Toshkent, Chilonzor..." />
      </div>

      {mut.isError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{getMsg(mut.error)}</p>}
      {mut.isSuccess && <p className="text-emerald-600 text-sm bg-emerald-50 px-3 py-2 rounded-xl">Saqlandi</p>}

      <button onClick={handleSave} disabled={mut.isPending}
        className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
        {mut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </div>
  );
}

// ─── KIRISH TAB ───────────────────────────────────────────────────────────────
function LoginTab({ profile, mut }: {
  profile: ProfileData;
  mut: ReturnType<typeof useMutation<ProfileData, unknown, object>>;
}) {
  const [username, setUsername] = useState(profile.username ?? '');
  const [email,    setEmail]    = useState(profile.email ?? '');
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  async function handlePwChange() {
    setPwError('');
    setPwSuccess('');
    if (!pwForm.old) { setPwError('Eski parolni kiriting'); return; }
    if (pwForm.new.length < 8) { setPwError('Yangi parol kamida 8 belgi'); return; }
    if (pwForm.new !== pwForm.confirm) { setPwError('Parollar mos emas'); return; }

    setPwLoading(true);
    try {
      await api.post('/users/change-password', { oldPassword: pwForm.old, newPassword: pwForm.new });
      setPwSuccess('Parol muvaffaqiyatli o\'zgartirildi');
      setPwForm({ old: '', new: '', confirm: '' });
    } catch (err) {
      setPwError(getMsg(err));
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Username + Email */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Login ma'lumotlari</h3>
        <div>
          <label className={LABEL}>Username</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
            <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className={INPUT + ' pl-7'} placeholder="username" />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Faqat kichik harf, raqam va _</p>
        </div>
        <div>
          <label className={LABEL}>Email (ixtiyoriy)</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" className={INPUT} placeholder="email@example.com" />
        </div>
        {mut.isError && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{getMsg(mut.error)}</p>}
        {mut.isSuccess && <p className="text-emerald-600 text-sm bg-emerald-50 px-3 py-2 rounded-xl">Saqlandi</p>}
        <button onClick={() => mut.mutate({ username: username || undefined, email: email || undefined })}
          disabled={mut.isPending}
          className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition">
          {mut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>

      <hr className="border-gray-100" />

      {/* Parol o'zgartirish */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Parol o'zgartirish</h3>
        <div>
          <label className={LABEL}>Eski parol</label>
          <input value={pwForm.old} onChange={e => setPwForm(p => ({ ...p, old: e.target.value }))}
            type="password" className={INPUT} placeholder="••••••••" />
        </div>
        <div>
          <label className={LABEL}>Yangi parol</label>
          <input value={pwForm.new} onChange={e => setPwForm(p => ({ ...p, new: e.target.value }))}
            type="password" className={INPUT} placeholder="Kamida 8 belgi" />
        </div>
        <div>
          <label className={LABEL}>Yangi parolni tasdiqlang</label>
          <input value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            type="password" className={INPUT} placeholder="••••••••" />
        </div>
        {pwError   && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-xl">{pwError}</p>}
        {pwSuccess && <p className="text-emerald-600 text-sm bg-emerald-50 px-3 py-2 rounded-xl">{pwSuccess}</p>}
        <button onClick={handlePwChange} disabled={pwLoading}
          className="px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium hover:bg-gray-900 disabled:opacity-60 transition">
          {pwLoading ? 'Saqlanmoqda...' : 'Parolni o\'zgartirish'}
        </button>
      </div>
    </div>
  );
}

// ─── QO'SHIMCHA TAB ───────────────────────────────────────────────────────────
function ExtraTab({ profile }: { profile: ProfileData }) {
  const role = profile.role;

  return (
    <div className="space-y-5">
      {/* O'QUVCHI */}
      {role === 'student' && (
        <>
          {/* Fanlar va guruhlar */}
          {profile.enrollments?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">O'qiyotgan fanlar</h3>
              <div className="space-y-2">
                {profile.enrollments.map(e => (
                  <div key={e.id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{e.subjectName}</p>
                      <p className="text-xs text-gray-400">{e.groupName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold ${e.attendance.rate >= 80 ? 'text-emerald-600' : e.attendance.rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {e.attendance.rate}%
                      </p>
                      <p className="text-xs text-gray-400">{e.attendance.present}/{e.attendance.total} dars</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Hech qaysi guruhga yozilmagan</p>
          )}

          {/* To'lov holati */}
          {profile.payments && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">To'lov holati</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Jami to'langan</p>
                  <p className="font-semibold text-gray-900">
                    {Number(profile.payments.totalPaid).toLocaleString('uz-UZ')} so'm
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  profile.payments.paidThisMonth ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {profile.payments.paidThisMonth ? 'Bu oy to\'langan' : 'To\'lov kerak'}
                </span>
              </div>
            </div>
          )}

          {/* Ball tarixi */}
          {profile.recentPoints?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">So'nggi ballar</h3>
              <div className="space-y-1.5">
                {profile.recentPoints.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-600">{p.reason}</span>
                    <span className={`text-sm font-semibold ${p.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {p.points > 0 ? '+' : ''}{p.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Qayerdan keldi */}
          {profile.referralSource && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm">
              <span className="text-gray-500">Kim orqali keldi: </span>
              <span className="font-medium text-gray-900">{profile.referralSource}</span>
            </div>
          )}
        </>
      )}

      {/* USTOZ */}
      {(role === 'ustoz' || role === 'manager') && (
        <>
          {profile.groups?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Mening guruhlarim</h3>
              <div className="space-y-2">
                {profile.groups.map(g => (
                  <div key={g.id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{g.name}</p>
                      <p className="text-xs text-gray-400">{g.subjectName}</p>
                    </div>
                    <span className="text-sm text-gray-600 font-medium">
                      {g.currentStudents}/{g.maxStudents}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Ball statistikasi */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{profile.monthlyPoints ?? 0}</p>
              <p className="text-xs text-emerald-600 mt-1">Bu oylik ball</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{profile.totalPoints}</p>
              <p className="text-xs text-gray-500 mt-1">Jami ball</p>
            </div>
          </div>

          {/* So'nggi ballar */}
          {profile.recentPoints?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">So'nggi ballar</h3>
              <div className="space-y-1.5">
                {profile.recentPoints.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-600">{p.reason}</span>
                    <span className={`text-sm font-semibold ${p.points > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {p.points > 0 ? '+' : ''}{p.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* SUPER ADMIN */}
      {role === 'super_admin' && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2"></div>
          <p className="text-sm">Super Admin — to'liq huquqlar</p>
          <p className="text-xs mt-1">Jami: {profile.totalPoints} ball</p>
        </div>
      )}
    </div>
  );
}

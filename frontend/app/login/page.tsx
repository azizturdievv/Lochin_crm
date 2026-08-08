'use client';

import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { LoginResponse, TwoFAResponse, User } from '@/types';

// ─── VALIDATSIYA SXEMALARI ────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z.string().min(3, 'Email yoki username kiriting'),
  password:   z.string().min(8, 'Kamida 8 belgi'),
});

const twoFASchema = z.object({
  code: z.string().length(6, 'Kod 6 raqam bo\'lishi shart'),
});

type LoginForm = z.infer<typeof loginSchema>;
type TwoFAForm  = z.infer<typeof twoFASchema>;

// ─── LOGIN SAHIFASI ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const router         = useRouter();
  const { setTokens, setUser } = useAuthStore();

  const [step,      setStep]      = useState<'login' | '2fa'>('login');
  const [userId,    setUserId]    = useState<string>('');
  const [twoFAType, setTwoFAType] = useState<'sms' | 'totp'>('sms');
  const [apiError,  setApiError]  = useState<string>('');

  // Login forma
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // 2FA forma
  const twoFAForm = useForm<TwoFAForm>({
    resolver: zodResolver(twoFASchema),
    defaultValues: { code: '' },
  });

  // ─── LOGIN SUBMIT ──────────────────────────────────────────────────────────
  async function onLogin(data: LoginForm) {
    setApiError('');
    try {
      const res = await api.post<LoginResponse>('/auth/login', { identifier: data.identifier, password: data.password, deviceInfo: navigator.userAgent });
      const body = res.data;

      if (body.requires2FA && body.userId) {
        setUserId(body.userId);
        setTwoFAType(body.twoFAType ?? 'sms');
        setStep('2fa');
        return;
      }

      if (body.accessToken && body.refreshToken && body.user) {
        setTokens(body.accessToken, body.refreshToken);
        setUser(body.user);
        redirectAfterAuth(body.user);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Login xatolik. Qayta urinib ko\'ring.';
      setApiError(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  // ─── 2FA SUBMIT ───────────────────────────────────────────────────────────
  async function on2FA(data: TwoFAForm) {
    setApiError('');
    try {
      const res = await api.post<TwoFAResponse>('/auth/2fa/verify', {
        userId,
        code: data.code,
      });
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      redirectAfterAuth(user);
    } catch {
      setApiError('Noto\'g\'ri kod. Qayta urinib ko\'ring.');
      twoFAForm.setValue('code', '');
    }
  }

  // SA/Manager uchun 2FA hali yoqilmagan bo'lsa — dashboard'ga emas, majburiy
  // sozlash sahifasiga yuboriladi (backend TwoFaEnforcementGuard baribir
  // dashboard'dagi barcha so'rovlarni bloklaydi, shuning uchun bu yerda oldindan
  // to'g'ri yo'naltirish kerak)
  function redirectAfterAuth(user: User) {
    const needsSetup = (user.role === 'super_admin' || user.role === 'manager') && !user.twoFaEnabled;
    router.replace(needsSetup ? '/login/2fa-required' : '/dashboard');
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">

      {/* Chap panel — brend (faqat lg va undan katta ekranda) */}
      {/* Tailwind gradient utility bu loyihada compile bo'lmagani uchun inline style ishlatildi */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(to bottom right, #3D5EE1, #2C44A9)' }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="relative z-10 text-center text-white max-w-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-3 mb-6 shadow-lg">
            <img src="/icon.png" alt="Lochin School" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Lochin School CRM</h1>
          <p className="text-primary-100 text-sm leading-relaxed">
            O'quv markazingizni boshqarish uchun professional platforma
          </p>
        </div>
      </div>

      {/* O'ng panel — forma */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo — faqat kichik ekranda (lg'da chap panelda ko'rsatiladi) */}
        <div className="lg:hidden text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-lg mb-4 p-2.5">
            <img src="/icon.png" alt="Lochin School" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Lochin School CRM</h1>
        </div>

        <div className="text-center mb-8">
          <p className="text-gray-500 text-sm mt-1">
            {step === 'login' ? 'Hisobingizga kiring' : 'Tasdiqlash kodini kiriting'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* ── LOGIN FORMA ─────────────────────────────────────────── */}
          {step === 'login' && (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email yoki username
                </label>
                <input
                  {...loginForm.register('identifier')}
                  type="text"
                  autoComplete="username"
                  placeholder="admin@ilmacademy.uz yoki aziz_001"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition"
                />
                {loginForm.formState.errors.identifier && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.identifier.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Parol
                </label>
                <input
                  {...loginForm.register('password')}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition"
                />
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-xs mt-1">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {loginForm.formState.isSubmitting ? 'Kirmoqda...' : 'Kirish'}
              </button>
            </form>
          )}

          {/* ── 2FA FORMA ───────────────────────────────────────────── */}
          {step === '2fa' && (
            <form onSubmit={twoFAForm.handleSubmit(on2FA)} className="space-y-5">
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
                {twoFAType === 'sms'
                  ? 'Telefon raqamingizga 6 raqamli kod yuborildi.'
                  : 'Google Authenticator ilovasidagi 6 raqamli kodni kiriting.'}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tasdiqlash kodi
                </label>
                <input
                  {...twoFAForm.register('code')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-2xl tracking-widest font-mono transition"
                />
                {twoFAForm.formState.errors.code && (
                  <p className="text-red-500 text-xs mt-1">
                    {twoFAForm.formState.errors.code.message}
                  </p>
                )}
              </div>

              {apiError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  {apiError}
                </div>
              )}

              <button
                type="submit"
                disabled={twoFAForm.formState.isSubmitting}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {twoFAForm.formState.isSubmitting ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('login'); setApiError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={14} /> Orqaga qaytish
              </button>
            </form>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

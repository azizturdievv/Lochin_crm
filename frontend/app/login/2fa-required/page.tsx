'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import TwoFaSetupModal from '@/components/settings/TwoFaSetupModal';

// SA/Manager uchun 2FA hali yoqilmagan bo'lsa, login shu sahifaga yo'naltiradi.
// Backend TwoFaEnforcementGuard baribir /dashboard'dagi barcha so'rovlarni
// bloklaydi — shuning uchun bu yerdan chetlab o'tib bo'lmaydi.
export default function TwoFaRequiredPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    // 2FA allaqachon yoqilgan (masalan, boshqa oynada tasdiqlangan) — kerak emas
    if (user.twoFaEnabled) {
      router.replace('/dashboard');
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated || !isAuthenticated || !user || user.twoFaEnabled) {
    return null;
  }

  function handleSuccess() {
    setUser({ ...user!, twoFaEnabled: true });
    router.replace('/dashboard');
  }

  // Bekor qilish = keyinroq kirish uchun chiqish (dashboard'ga yarim-avtorizatsiya
  // bilan kirib, hamma joyda 403 ko'rishning oldini oladi)
  function handleCancel() {
    logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm mb-6">
        <h1 className="text-lg font-semibold text-gray-900">2FA sozlash shart</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.role === 'super_admin' ? 'Super Admin' : 'Manager'} hisoblari uchun ikki bosqichli
          tasdiqlash (2FA) majburiy — davom etishdan oldin sozlang.
        </p>
      </div>
      <TwoFaSetupModal onClose={handleCancel} onSuccess={handleSuccess} />
    </div>
  );
}

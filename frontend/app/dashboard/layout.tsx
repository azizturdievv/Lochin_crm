'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/MobileBottomNav';
import PaymentLockBanner from '@/components/payments/PaymentLockBanner';
import ToastContainer from '@/components/ToastContainer';
import CommandPalette from '@/components/CommandPalette';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { AccessStatus } from '@/types/payments';

// Qulflangan o'quvchi ham kira oladigan yagona yo'llar (to'lov qilish yo'q — admin bilan bog'lanish uchun Chat, o'zini ko'rish uchun Profil)
const LOCK_EXEMPT_PREFIXES = ['/dashboard/chat', '/dashboard/profile'];

// Sahifa sarlavhalarini URL dan aniqlash
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/dashboard/students':     "O'quvchilar",
  '/dashboard/payments':     "To'lovlar",
  '/dashboard/schedule':     'Jadval',
  '/dashboard/attendance':   'Davomat',
  '/dashboard/lms':          'LMS',
  '/dashboard/gamification': "Rag'bat",
  '/dashboard/groups':       'Guruhlarim',
  '/dashboard/leads':        'Lidlar',
  '/dashboard/finance':      'Moliya',
  '/dashboard/staff':        'Xodimlar',
  '/dashboard/events':       'Tadbirlar',
  '/dashboard/substitutions':"O'rinbosarlik",
  '/dashboard/chat':         'Chat',
  '/dashboard/live':         'Jonli efir',
  '/dashboard/quality':      'Sifat nazorati',
  '/dashboard/reports':      'Hisobotlar',
  '/dashboard/settings':     'Sozlamalar',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router           = useRouter();
  const pathname         = usePathname();
  const user             = useAuthStore((s) => s.user);
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated      = useAuthStore((s) => s.hasHydrated);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Token yo'q → login ga yo'naltirish (faqat localStorage tiklangandan keyin)
  useEffect(() => {
    if (hasHydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Rol bo'yicha urg'u rangi (mobil ilova palitrasi) — globals.css'dagi
  // :root[data-role="..."] bloklari shu attributega qarab ishlaydi
  useEffect(() => {
    if (user?.role) document.documentElement.dataset.role = user.role;
    return () => { delete document.documentElement.dataset.role; };
  }, [user?.role]);

  // Sahifa almashganda mobil drawer'ni yopish
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // To'lov avto-blok holati — faqat o'quvchi uchun
  const { data: accessStatus } = useQuery({
    queryKey: ['payment-access-status', user?.id],
    queryFn:  () => api.get<AccessStatus>(`/payments/students/${user!.id}/access-status`).then(r => r.data),
    enabled:  hasHydrated && isAuthenticated && user?.role === 'student',
  });

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Eng uzun mos keluvchi sarlavhani topish
  const title = Object.entries(PAGE_TITLES)
    .filter(([path]) => pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Dashboard';

  const isExemptRoute = LOCK_EXEMPT_PREFIXES.some(p => pathname.startsWith(p));
  const showLockBanner = user?.role === 'student' && accessStatus?.isLocked && !isExemptRoute;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
          {showLockBanner ? <PaymentLockBanner status={accessStatus} /> : children}
        </main>
      </div>
      <MobileBottomNav onMoreClick={() => setSidebarOpen(true)} />
      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

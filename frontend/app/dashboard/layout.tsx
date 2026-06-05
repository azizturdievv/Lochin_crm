'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { useAuthStore } from '@/store/auth.store';

// Sahifa sarlavhalarini URL dan aniqlash
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/dashboard/students':     "O'quvchilar",
  '/dashboard/payments':     "To'lovlar",
  '/dashboard/schedule':     'Jadval',
  '/dashboard/attendance':   'Davomat',
  '/dashboard/lms':          'LMS',
  '/dashboard/groups':       'Guruhlarim',
  '/dashboard/leads':        'Lidlar',
  '/dashboard/finance':      'Moliya',
  '/dashboard/staff':        'Xodimlar',
  '/dashboard/events':       'Tadbirlar',
  '/dashboard/substitutions':"O'rinbosarlik",
  '/dashboard/chat':         'Chat',
  '/dashboard/quality':      'Sifat nazorati',
  '/dashboard/reports':      'Hisobotlar',
  '/dashboard/settings':     'Sozlamalar',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router           = useRouter();
  const pathname         = usePathname();
  const isAuthenticated  = useAuthStore((s) => s.isAuthenticated);

  // Token yo'q → login ga yo'naltirish
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
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

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

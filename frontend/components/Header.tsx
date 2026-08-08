'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';
import { Search, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import SlaAlertWidget from '@/components/SlaAlertWidget';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const router  = useRouter();
  const { user, logout } = useAuthStore();
  const isSA = user?.role === 'super_admin';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Token muddati o'tgan bo'lishi mumkin
    } finally {
      logout();
      router.replace('/login');
    }
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 h-16 px-6 bg-white border-b border-gray-200">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-gray-900 shrink-0">{title}</h1>

        {/* Global qidiruv (vizual) */}
        <div className="relative hidden md:block flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            data-cmdk-trigger="true"
            readOnly
            placeholder="Qidirish..."
            className="w-full pl-9 pr-14 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-400 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
            ⌘K
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <SlaAlertWidget />
        <NotificationBell />

        {/* Profil menyu */}
        <div className="relative pl-3 border-l border-gray-200" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 rounded-xl hover:bg-gray-50 transition-colors p-1 pr-2"
          >
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-700 text-xs font-bold">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {user?.firstName}
            </span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform hidden sm:block ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 py-1">
              <Link
                href="/dashboard/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} className="text-gray-400" /> Profil
              </Link>
              {isSA && (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={15} className="text-gray-400" /> Sozlamalar
                </Link>
              )}
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut size={15} /> Chiqish
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

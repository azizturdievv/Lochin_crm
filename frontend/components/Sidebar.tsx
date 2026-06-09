'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types';

interface NavItem {
  label:    string;
  href:     string;
  icon:     string;
  roles:    Role[];
  badge?:   string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Profil',           href: '/dashboard/profile',           icon: '👤', roles: ['super_admin','manager','ustoz','student'] },
  { label: 'Dashboard',       href: '/dashboard',                   icon: '📊', roles: ['super_admin','manager','ustoz','student'] },
  { label: "O'quvchilar",     href: '/dashboard/students',          icon: '👥', roles: ['super_admin','manager'] },
  { label: "To'lovlar",       href: '/dashboard/payments',          icon: '💳', roles: ['super_admin','manager'] },
  { label: 'Jadval',          href: '/dashboard/schedule',          icon: '📅', roles: ['super_admin','manager','ustoz','student'] },
  { label: 'Davomat',         href: '/dashboard/attendance',        icon: '✅', roles: ['super_admin','manager','ustoz'] },
  { label: 'LMS',             href: '/dashboard/lms',               icon: '📚', roles: ['super_admin','manager','ustoz','student'] },
  { label: 'Guruhlar',        href: '/dashboard/groups',            icon: '🏫', roles: ['super_admin','manager'] },
  { label: 'Guruhlarim',      href: '/dashboard/groups',            icon: '🏫', roles: ['ustoz'] },
  { label: 'Lidlar',          href: '/dashboard/leads',             icon: '🎯', roles: ['super_admin','manager'] },
  { label: 'Moliya',          href: '/dashboard/finance',           icon: '📈', roles: ['super_admin'] },
  { label: 'Xodimlar',        href: '/dashboard/staff',             icon: '👔', roles: ['super_admin'] },
  { label: 'Tadbirlar',       href: '/dashboard/events',            icon: '🏆', roles: ['super_admin','manager'] },
  { label: "O'rinbosarlik",   href: '/dashboard/substitutions',     icon: '🔄', roles: ['super_admin','manager'] },
  { label: 'Chat',            href: '/dashboard/chat',              icon: '💬', roles: ['super_admin','manager','ustoz','student'] },
  { label: 'Sifat nazorati',  href: '/dashboard/quality',           icon: '🔍', roles: ['super_admin','manager','ustoz','student'] },
  { label: 'Hisobotlar',      href: '/dashboard/reports',           icon: '📋', roles: ['super_admin','manager'] },
  { label: 'Sozlamalar',      href: '/dashboard/settings',          icon: '⚙️', roles: ['super_admin'] },
];

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  manager:     'Manager',
  ustoz:       'Ustoz',
  student:     "O'quvchi",
};

const ROLE_COLORS: Record<Role, string> = {
  super_admin: 'bg-purple-100 text-purple-700',
  manager:     'bg-blue-100 text-blue-700',
  ustoz:       'bg-sky-100 text-sky-700',
  student:     'bg-amber-100 text-amber-700',
};

export default function Sidebar() {
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);
  const role     = user?.role ?? 'student';

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role as Role));

  return (
    <aside className="flex flex-col w-64 shrink-0 bg-white border-r border-gray-200 h-screen sticky top-0 overflow-y-auto">

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
          <span className="text-white text-sm font-bold">IA</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">Ilm Academy</p>
          <p className="text-gray-400 text-xs truncate">CRM v1.0</p>
        </div>
      </div>

      {/* Rol badge */}
      {user && (
        <div className="px-5 py-3 border-b border-gray-100">
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[role as Role]}`}>
            {ROLE_LABELS[role as Role]}
          </span>
        </div>
      )}

      {/* Navigatsiya */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.badge && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — profil havolasi */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link href="/dashboard/profile"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            pathname === '/dashboard/profile'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}>
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-emerald-700 text-xs font-bold">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user?.username ? `@${user.username}` : user?.email ?? ''}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}

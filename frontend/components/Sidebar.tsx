'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types';
import type { LucideIcon } from 'lucide-react';
import {
  User, LayoutDashboard, Users, CreditCard, Calendar, ClipboardCheck,
  BookOpen, School, Target, TrendingUp, Briefcase, Trophy, RefreshCw,
  MessageSquare, SearchCheck, FileBarChart, Settings, Video, X, Award,
} from 'lucide-react';

type NavGroup = 'ASOSIY' | "O'QUV" | 'MOLIYA' | 'BOSHQARUV' | 'ALOQA';

interface NavItem {
  label:    string;
  href:     string;
  icon:     LucideIcon;
  roles:    Role[];
  group:    NavGroup;
  badge?:   string;
}

const NAV_ITEMS: NavItem[] = [
  // ASOSIY
  { label: 'Dashboard',       href: '/dashboard',                   icon: LayoutDashboard, roles: ['super_admin','manager','ustoz','student'], group: 'ASOSIY' },
  { label: 'Profil',           href: '/dashboard/profile',           icon: User,            roles: ['super_admin','manager','ustoz','student'], group: 'ASOSIY' },
  // O'QUV
  { label: "O'quvchilar",     href: '/dashboard/students',          icon: Users,           roles: ['super_admin','manager'], group: "O'QUV" },
  { label: 'Guruhlar',        href: '/dashboard/groups',            icon: School,          roles: ['super_admin','manager'], group: "O'QUV" },
  { label: 'Guruhlarim',      href: '/dashboard/groups',            icon: School,          roles: ['ustoz'], group: "O'QUV" },
  { label: 'Jadval',          href: '/dashboard/schedule',          icon: Calendar,        roles: ['super_admin','manager','ustoz','student'], group: "O'QUV" },
  { label: 'Davomat',         href: '/dashboard/attendance',        icon: ClipboardCheck,  roles: ['super_admin','manager','ustoz'], group: "O'QUV" },
  { label: 'LMS',             href: '/dashboard/lms',               icon: BookOpen,        roles: ['super_admin','manager','ustoz','student'], group: "O'QUV" },
  { label: "Rag'bat",         href: '/dashboard/gamification',      icon: Award,           roles: ['super_admin','manager','ustoz','student'], group: "O'QUV" },
  // MOLIYA
  { label: "To'lovlar",       href: '/dashboard/payments',          icon: CreditCard,      roles: ['super_admin','manager'], group: 'MOLIYA' },
  { label: 'Moliya',          href: '/dashboard/finance',           icon: TrendingUp,      roles: ['super_admin'], group: 'MOLIYA' },
  // BOSHQARUV
  { label: 'Lidlar',          href: '/dashboard/leads',             icon: Target,          roles: ['super_admin','manager'], group: 'BOSHQARUV' },
  { label: 'Xodimlar',        href: '/dashboard/staff',             icon: Briefcase,       roles: ['super_admin'], group: 'BOSHQARUV' },
  { label: 'Tadbirlar',       href: '/dashboard/events',            icon: Trophy,          roles: ['super_admin','manager'], group: 'BOSHQARUV' },
  { label: "O'rinbosarlik",   href: '/dashboard/substitutions',     icon: RefreshCw,       roles: ['super_admin','manager'], group: 'BOSHQARUV' },
  // ALOQA
  { label: 'Chat',            href: '/dashboard/chat',              icon: MessageSquare,   roles: ['super_admin','manager','ustoz','student'], group: 'ALOQA' },
  { label: 'Jonli efir',      href: '/dashboard/live',              icon: Video,           roles: ['super_admin','manager','ustoz','student'], group: 'ALOQA' },
  { label: 'Sifat nazorati',  href: '/dashboard/quality',           icon: SearchCheck,     roles: ['super_admin','manager','ustoz','student'], group: 'ALOQA' },
  { label: 'Hisobotlar',      href: '/dashboard/reports',           icon: FileBarChart,    roles: ['super_admin','manager'], group: 'ALOQA' },
  { label: 'Sozlamalar',      href: '/dashboard/settings',          icon: Settings,        roles: ['super_admin'], group: 'ALOQA' },
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

interface Props {
  isOpen?:  boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);
  const role     = user?.role ?? 'student';

  const items = NAV_ITEMS.filter((item) => item.roles.includes(role as Role));

  return (
    <>
      {/* Mobil orqa fon — drawer ochiq bo'lganda bosilsa yopiladi */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        flex flex-col w-64 shrink-0 bg-white border-r border-gray-200 h-screen overflow-y-auto
        fixed md:sticky top-0 z-50 md:z-auto transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
      `}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden p-1">
          <img src="/icon.png" alt="Lochin School" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">Lochin School</p>
          <p className="text-gray-400 text-xs truncate">CRM v1.0</p>
        </div>
        <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 shrink-0">
          <X size={20} />
        </button>
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
        {items.map((item, i) => {
          const isActive = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const showGroupLabel = item.group !== items[i - 1]?.group;

          return (
            <div key={item.href + item.label}>
              {showGroupLabel && (
                <p className={`text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1 ${i === 0 ? 'pt-0' : 'pt-4'}`}>
                  {item.group}
                </p>
              )}
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer — profil havolasi */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link href="/dashboard/profile" onClick={onClose}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            pathname === '/dashboard/profile'
              ? 'bg-primary-50 text-primary-700'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}>
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-700 text-xs font-bold">
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
    </>
  );
}

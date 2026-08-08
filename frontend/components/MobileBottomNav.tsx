'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, BookOpen, MessageSquare, Menu } from 'lucide-react';

interface Props {
  onMoreClick: () => void;
}

const ITEMS = [
  { label: 'Dashboard', href: '/dashboard',         icon: LayoutDashboard },
  { label: 'Jadval',    href: '/dashboard/schedule', icon: Calendar },
  { label: 'LMS',       href: '/dashboard/lms',      icon: BookOpen },
  { label: 'Chat',      href: '/dashboard/chat',     icon: MessageSquare },
];

export default function MobileBottomNav({ onMoreClick }: Props) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map(item => {
        const isActive = item.href === '/dashboard'
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary-600' : 'text-gray-400'
            }`}
          >
            <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span className="truncate max-w-full px-1">{item.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 transition-colors"
      >
        <Menu size={20} />
        <span>Ko&apos;proq</span>
      </button>
    </nav>
  );
}

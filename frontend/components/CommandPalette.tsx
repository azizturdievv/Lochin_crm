'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, School, CreditCard, Target, CornerDownLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface StudentHit { id: string; firstName: string; lastName: string; phone: string | null }
interface GroupHit   { id: string; name: string }

interface ResultItem {
  key:     string;
  icon:    React.ReactNode;
  label:   string;
  sub?:    string;
  onSelect: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const user   = useAuthStore((s) => s.user);
  const role   = user?.role;

  const [open,     setOpen]     = useState(false);
  const [query,    setQuery]    = useState('');
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [groups,   setGroups]   = useState<GroupHit[]>([]);
  const [selected,  setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSeeStudents = role === 'super_admin' || role === 'manager' || role === 'ustoz';
  const canSeeGroups   = true; // barcha rollar o'ziga tegishlisini ko'radi
  const canManage      = role === 'super_admin' || role === 'manager';

  // ─── GLOBAL ⌘K / CTRL+K ────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Header'dagi vizual qidiruv inputiga bosilganda ham ochiladi
  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const el = e.target as HTMLElement;
      if (el?.dataset?.cmdkTrigger === 'true') {
        e.preventDefault();
        (el as HTMLInputElement).blur();
        setOpen(true);
      }
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // ─── QIDIRUV (debounce) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setStudents([]);
      setGroups([]);
      return;
    }
    const t = setTimeout(async () => {
      const calls: Promise<void>[] = [];
      if (canSeeStudents) {
        calls.push(
          api.get('/students', { params: { search: query, limit: 5 } })
            .then((r) => setStudents(r.data?.data ?? []))
            .catch(() => setStudents([])),
        );
      }
      if (canSeeGroups) {
        calls.push(
          api.get('/groups', { params: { search: query, limit: 5 } })
            .then((r) => setGroups(r.data?.data ?? r.data ?? []))
            .catch(() => setGroups([])),
        );
      }
      await Promise.all(calls);
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, canSeeStudents, canSeeGroups]);

  const goTo = useCallback((path: string) => {
    router.push(path);
    setOpen(false);
  }, [router]);

  // ─── NATIJALARNI BITTA RO'YXATGA YIG'ISH (klaviatura navigatsiyasi uchun) ──
  const actions: ResultItem[] = query.trim().length < 2 ? [
    ...(canManage ? [
      { key: 'act-payment', icon: <CreditCard size={16} />, label: "To'lov qabul qilish", onSelect: () => goTo('/dashboard/payments') },
      { key: 'act-lead',    icon: <Target size={16} />,     label: 'Lid qo\'shish',        onSelect: () => goTo('/dashboard/leads') },
    ] : []),
  ] : [];

  const studentItems: ResultItem[] = students.map((s) => ({
    key: `st-${s.id}`,
    icon: <Users size={16} />,
    label: `${s.firstName} ${s.lastName}`,
    sub: s.phone ?? undefined,
    // Backend qidiruvi firstName/lastName'ni ALOHIDA (OR) tekshiradi — to'liq
    // ismni yuborsak hech biriga mos kelmaydi, shuning uchun faqat ismni yuboramiz
    onSelect: () => goTo(`/dashboard/students?q=${encodeURIComponent(s.firstName)}`),
  }));

  const groupItems: ResultItem[] = groups.map((g) => ({
    key: `gr-${g.id}`,
    icon: <School size={16} />,
    label: g.name,
    onSelect: () => goTo(`/dashboard/groups?q=${encodeURIComponent(g.name)}`),
  }));

  const allItems = [...actions, ...studentItems, ...groupItems];

  function onKeyNav(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      allItems[selected]?.onSelect();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKeyNav}
            placeholder="O'quvchi, guruh qidiring yoki amal tanlang..."
            className="flex-1 text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {allItems.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">
              {query.trim().length < 2 ? 'Kamida 2 belgi kiriting yoki tezkor amaldan foydalaning' : 'Hech narsa topilmadi'}
            </p>
          )}

          {actions.length > 0 && (
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tezkor amallar</div>
          )}
          {studentItems.length > 0 && (
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">O'quvchilar</div>
          )}
          {groupItems.length > 0 && (
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Guruhlar</div>
          )}

          {allItems.map((item, i) => (
            <button
              key={item.key}
              onClick={item.onSelect}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                i === selected ? 'bg-primary-50 text-primary-800' : 'text-gray-700'
              }`}
            >
              <span className="text-gray-400 shrink-0">{item.icon}</span>
              <span className="flex-1 min-w-0 truncate">{item.label}</span>
              {item.sub && <span className="text-xs text-gray-400 shrink-0">{item.sub}</span>}
              {i === selected && <CornerDownLeft size={13} className="text-primary-400 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

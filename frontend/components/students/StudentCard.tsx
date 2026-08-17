'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { MoreVertical, MessageSquare, Phone, Mail, CreditCard } from 'lucide-react';
import type { Student } from '@/types/students';

interface Props {
  student:  Student;
  onEdit:   () => void;
  onDelete: () => void;
  onEnroll: () => void;
  onCreds:  () => void;
}

const STATUS_CONFIG = {
  active:   { label: 'Faol',        cls: 'bg-emerald-100 text-emerald-700' },
  inactive: { label: 'Arxivlangan', cls: 'bg-gray-100 text-gray-500'      },
};

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit' });
}

export default function StudentCard({ student, onEdit, onDelete, onEnroll, onCreds }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const initials = `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  const status   = STATUS_CONFIG[student.isActive ? 'active' : 'inactive'];

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col gap-3">
      {/* Tepa qator: ID + status + menyu */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-gray-400">#{student.id.slice(0, 8).toUpperCase()}</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            ><MoreVertical size={14} /></button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-1">
                <button onClick={() => { setMenuOpen(false); onEdit(); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">Tahrirlash</button>
                <button onClick={() => { setMenuOpen(false); onEnroll(); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">Guruhga yozish</button>
                <button onClick={() => { setMenuOpen(false); onCreds(); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">Kirish ma&apos;lumotlari</button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">Arxivlash</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Markaz: avatar + ism + guruh */}
      <Link href={`/dashboard/students/${student.id}`} className="flex flex-col items-center text-center gap-2 py-1 group">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center overflow-hidden shrink-0">
          {student.avatarUrl ? (
            <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-emerald-700 text-lg font-bold">{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-primary-600 transition-colors">
            {student.lastName} {student.firstName}
          </p>
          {/* Ro'yxat endpointi guruh ma'lumotini qaytarmaydi — jadval ko'rinishidagidek bo'sh qoladi */}
          <p className="text-xs text-gray-400">—</p>
        </div>
      </Link>

      {/* Sinf / Tug'ilgan sana / Qo'shilgan sana */}
      <div className="grid grid-cols-3 gap-1 text-center border-t border-b border-gray-50 py-2.5">
        <div>
          <p className="text-[10px] text-gray-400">Sinf</p>
          <p className="text-xs font-medium text-gray-700">{student.schoolGrade ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Tug'ilgan</p>
          <p className="text-xs font-medium text-gray-700">{student.birthDate ? fmtShort(student.birthDate) : '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400">Qo'shilgan</p>
          <p className="text-xs font-medium text-gray-700">{fmtShort(student.createdAt)}</p>
        </div>
      </div>

      {/* Footer: tez amallar + To'lov */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Link href="/dashboard/chat" title="Xabar yozish"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><MessageSquare size={14} /></Link>
          <a href={student.phone ? `tel:${student.phone}` : undefined} title="Qo'ng'iroq"
            className={`p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ${!student.phone ? 'opacity-30 pointer-events-none' : ''}`}><Phone size={14} /></a>
          <a href={student.email ? `mailto:${student.email}` : undefined} title="Email"
            className={`p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ${!student.email ? 'opacity-30 pointer-events-none' : ''}`}><Mail size={14} /></a>
        </div>
        <Link href={`/dashboard/students/${student.id}`}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1.5 rounded-lg transition-colors">
          <CreditCard size={12} /> To'lov
        </Link>
      </div>
    </div>
  );
}

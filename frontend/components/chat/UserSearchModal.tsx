'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ChatRoom } from '@/types/chat';

// ─── TIPLAR ───────────────────────────────────────────────────────────────────
interface SearchUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  role: string;
  avatarUrl: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  ustoz: 'Ustoz',
  student: "O'quvchi",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'text-purple-600 bg-purple-50',
  manager: 'text-blue-600 bg-blue-50',
  ustoz: 'text-sky-600 bg-sky-50',
  student: 'text-amber-600 bg-amber-50',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onRoomCreated: (room: ChatRoom) => void;
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export default function UserSearchModal({ open, onClose, onRoomCreated }: Props) {
  const qc              = useQueryClient();
  const [q, setQ]       = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const inputRef        = useRef<HTMLInputElement>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus va reset
  useEffect(() => {
    if (open) {
      setQ('');
      setResults([]);
      setError('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounce qidiruv
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const res = await api.get<SearchUser[]>(`/users/search?q=${encodeURIComponent(q.trim())}`);
        setResults(res.data);
      } catch {
        setError('Qidirishda xatolik');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  const createRoomMut = useMutation({
    mutationFn: (targetUserId: string) =>
      api.post<ChatRoom>('/chat/rooms', { type: 'private', targetUserId }).then(r => r.data),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
      onRoomCreated(room);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setError(err?.response?.data?.message ?? 'Chat ochishda xatolik');
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Sarlavha */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Yangi chat</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition">
            ✕
          </button>
        </div>

        {/* Qidiruv */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              ref={inputRef}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Ism yoki @username kiriting..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-spin">⟳</span>
            )}
          </div>
        </div>

        {/* Natijalar */}
        <div className="max-h-80 overflow-y-auto">
          {error && (
            <p className="text-red-500 text-sm px-5 py-3 bg-red-50">{error}</p>
          )}

          {!q.trim() && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <div className="text-3xl mb-2">👥</div>
              <p className="text-sm">Qidirish uchun kamida 2 belgi kiriting</p>
            </div>
          )}

          {q.trim().length >= 2 && !searching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm">"{q}" uchun hech kim topilmadi</p>
            </div>
          )}

          {results.map(user => {
            const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
            const roleColor = ROLE_COLORS[user.role] ?? 'text-gray-600 bg-gray-50';

            return (
              <button
                key={user.id}
                onClick={() => createRoomMut.mutate(user.id)}
                disabled={createRoomMut.isPending}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-none text-left disabled:opacity-60"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-emerald-700 text-sm font-bold">{initials}</span>
                  )}
                </div>

                {/* Ma'lumot */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.lastName} {user.firstName}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${roleColor}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </div>
                  {user.username && (
                    <p className="text-xs text-emerald-600 mt-0.5">@{user.username}</p>
                  )}
                </div>

                {/* Bosish uchi */}
                <span className="text-gray-300 text-lg shrink-0">›</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {createRoomMut.isPending && (
          <div className="px-5 py-3 border-t border-gray-100 text-center">
            <p className="text-sm text-emerald-600 animate-pulse">Chat ochilmoqda...</p>
          </div>
        )}
      </div>
    </div>
  );
}

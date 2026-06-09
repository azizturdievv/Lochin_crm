'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ROOM_META } from '@/types/chat';
import UserSearchModal from './UserSearchModal';
import type { ChatRoom } from '@/types/chat';

interface Props {
  activeRoomId: string | null;
  onSelect:     (room: ChatRoom) => void;
  connected:    boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Hozir';
  if (m < 60) return `${m}d`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}k`;
}

function RoomItem({ room, isActive, onClick }: { room: ChatRoom; isActive: boolean; onClick: () => void }) {
  const meta    = ROOM_META[room.type];
  const name    = room.name ?? room.group?.name ?? 'Chat';
  const lastMsg = room.lastMessage;
  const unread  = room.unreadCount ?? 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-50 ${
        isActive ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-gray-50'
      }`}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl ${
        isActive ? 'bg-emerald-100' : 'bg-gray-100'
      }`}>
        {meta.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-700' : 'text-gray-900'}`}>
            {name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {unread > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
            {lastMsg && (
              <span className="text-[10px] text-gray-400">{timeAgo(lastMsg.createdAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[10px] font-medium ${meta.color}`}>{meta.label}</span>
          {lastMsg && (
            <p className="text-xs text-gray-400 truncate">
              · {lastMsg.type !== 'text' ? `[${lastMsg.type}]` : (lastMsg.content?.slice(0, 40) ?? '')}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function RoomList({ activeRoomId, onSelect, connected }: Props) {
  const user          = useAuthStore(s => s.user);
  const isSA          = user?.role === 'super_admin';
  const [search, setSearch]       = useState('');
  const [newChatOpen, setNewChat] = useState(false);
  const [saTab, setSaTab]         = useState<'mine' | 'all'>('mine');

  // Mening xonalarim
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['chat-rooms'],
    queryFn:  () => api.get<ChatRoom[]>('/chat/rooms').then(r => r.data),
    refetchInterval: 30_000,
  });

  // SA uchun barcha xonalar
  const { data: allRoomsData } = useQuery({
    queryKey: ['chat-rooms-all'],
    queryFn:  () => api.get<{ items: ChatRoom[]; total: number }>('/chat/rooms/all').then(r => r.data),
    enabled:  isSA && saTab === 'all',
    refetchInterval: 60_000,
  });

  const displayRooms = isSA && saTab === 'all' ? (allRoomsData?.items ?? []) : (rooms ?? []);

  const filtered = displayRooms.filter(r => {
    const name = r.name ?? r.group?.name ?? '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* ── Header ── */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">💬 Chat</h2>
          <div className="flex items-center gap-2">
            {/* Online indikator */}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-400">{connected ? 'Online' : 'Offline'}</span>
            </div>
            {/* Yangi chat tugmasi */}
            <button
              onClick={() => setNewChat(true)}
              title="Yangi chat"
              className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* SA tab tanlovi */}
        {isSA && (
          <div className="flex gap-1 mb-3 bg-gray-100 p-0.5 rounded-xl">
            <button onClick={() => setSaTab('mine')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                saTab === 'mine' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Mening chatlarim
            </button>
            <button onClick={() => setSaTab('all')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition ${
                saTab === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              Barcha chatlar
              {allRoomsData?.total ? <span className="ml-1 text-emerald-600">({allRoomsData.total})</span> : null}
            </button>
          </div>
        )}

        {/* Xona qidiruv */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Xonalarni qidiring..."
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {/* ── Xonalar ro'yxati ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse border-b border-gray-50">
              <div className="w-11 h-11 rounded-2xl bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">Xonalar topilmadi</p>
            <button onClick={() => setNewChat(true)}
              className="mt-3 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              + Yangi chat boshlash
            </button>
          </div>
        ) : (
          <>
            {isSA && saTab === 'all' && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                <p className="text-xs text-amber-700 font-medium">
                  🛡️ SA rejimi — barcha chatlar ko'rinmoqda. Har kirish audit log ga yoziladi.
                </p>
              </div>
            )}
            {filtered.map(room => (
              <RoomItem
                key={room.id}
                room={room}
                isActive={room.id === activeRoomId}
                onClick={() => onSelect(room)}
              />
            ))}
          </>
        )}
      </div>

      {/* Yangi chat modali */}
      <UserSearchModal
        open={newChatOpen}
        onClose={() => setNewChat(false)}
        onRoomCreated={room => onSelect(room)}
      />
    </div>
  );
}

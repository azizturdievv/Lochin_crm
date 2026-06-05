'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useChatSocket } from '@/hooks/useChatSocket';
import RoomList from '@/components/chat/RoomList';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageInput from '@/components/chat/MessageInput';
import { isReadOnly, ROOM_META } from '@/types/chat';
import type { ChatRoom, ChatMessage } from '@/types/chat';

export default function ChatPage() {
  const user        = useAuthStore(s => s.user);
  const qc          = useQueryClient();

  const [activeRoom,   setActiveRoom]   = useState<ChatRoom | null>(null);
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevRoomRef    = useRef<string | null>(null);

  const {
    connected, lastEvent, typingUsers,
    joinRoom, leaveRoom, sendMessage,
    sendTyping, stopTyping, markRead, deleteMsg,
  } = useChatSocket();

  // Xonaga qo'shilish / chiqish
  useEffect(() => {
    if (!activeRoom) return;
    const id = activeRoom.id;
    if (prevRoomRef.current && prevRoomRef.current !== id) {
      leaveRoom(prevRoomRef.current);
    }
    prevRoomRef.current = id;
    setMessages([]);
    setHistoryTotal(0);
    joinRoom(id);
  }, [activeRoom?.id]);

  // Socket hodisalarini qayta ishlash
  useEffect(() => {
    if (!lastEvent || !activeRoom) return;

    switch (lastEvent.type) {
      case 'room_history':
        if (lastEvent.roomId === activeRoom.id) {
          // Eski xabarlarni bosh qo'shish (load more)
          setMessages(prev =>
            loadingMore
              ? [...lastEvent.messages, ...prev]
              : lastEvent.messages
          );
          setHistoryTotal(lastEvent.total);
          setLoadingMore(false);
          if (!loadingMore) scrollToBottom();
        }
        break;

      case 'new_message':
        if (lastEvent.message.roomId === activeRoom.id) {
          setMessages(prev => [...prev, lastEvent.message]);
          scrollToBottom();
          // Oxirgi xabarni o'qildi deb belgilash
          markRead(activeRoom.id, lastEvent.message.id);
          // Xonalar ro'yxatini yangilash
          qc.invalidateQueries({ queryKey: ['chat-rooms'] });
        }
        break;

      case 'message_deleted':
        setMessages(prev =>
          prev.map(m =>
            m.id === lastEvent.messageId ? { ...m, isDeleted: true } : m
          )
        );
        break;

      case 'message_read':
        setMessages(prev =>
          prev.map(m =>
            m.id === lastEvent.messageId && !m.readBy.includes(lastEvent.userId)
              ? { ...m, readBy: [...m.readBy, lastEvent.userId] }
              : m
          )
        );
        break;

      case 'message_blocked':
        showToast(`🚫 ${lastEvent.text}`);
        break;

      case 'message_warning':
        showToast(`⚠️ ${lastEvent.text}`);
        break;
    }
  }, [lastEvent]);

  function scrollToBottom() {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleRoomSelect(room: ChatRoom) {
    setActiveRoom(room);
  }

  function handleSend(payload: object) {
    sendMessage(payload as { roomId: string; type: string; content?: string });
  }

  function handleDelete(messageId: string) {
    if (!activeRoom) return;
    deleteMsg(activeRoom.id, messageId);
  }

  async function handleLoadMore() {
    if (!activeRoom || loadingMore || messages.length >= historyTotal) return;
    setLoadingMore(true);
    joinRoom(activeRoom.id); // backend offset ni ko'radi
  }

  const roomTyping = typingUsers.filter(u => u.roomId === activeRoom?.id && u.userId !== user?.id);
  const readOnly   = activeRoom ? isReadOnly(activeRoom.type, user?.role ?? 'student') : false;
  const roomMeta   = activeRoom ? ROOM_META[activeRoom.type] : null;

  // Xabar guruhini aniqlash (bir xil yuboruvchi ketma-ket xabarlar)
  function shouldShowName(index: number): boolean {
    if (index === 0) return true;
    const cur  = messages[index];
    const prev = messages[index - 1];
    return cur.senderId !== prev.senderId;
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* ─── Xonalar ro'yxati (chap panel) ─── */}
      <div className="w-72 shrink-0">
        <RoomList
          activeRoomId={activeRoom?.id ?? null}
          onSelect={handleRoomSelect}
          connected={connected}
        />
      </div>

      {/* ─── Asosiy chat maydoni ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom && roomMeta ? (
          <>
            {/* Sarlavha */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                  {roomMeta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 truncate">
                      {activeRoom.name ?? activeRoom.group?.name ?? 'Chat'}
                    </h2>
                    <span className={`text-xs font-medium ${roomMeta.color}`}>
                      {roomMeta.label}
                    </span>
                  </div>
                  {activeRoom.group?.subject && (
                    <p className="text-xs text-gray-400 truncate">{activeRoom.group.subject.name}</p>
                  )}
                </div>
              </div>

              {/* Memberlar soni */}
              {activeRoom.members && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex -space-x-1">
                    {activeRoom.members.slice(0, 4).map(m => (
                      <div
                        key={m.id}
                        className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-emerald-700"
                        title={`${m.firstName} ${m.lastName}`}
                      >
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {activeRoom.members.length} a'zo
                  </span>
                </div>
              )}
            </div>

            {/* Xabarlar maydoni */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-0.5 relative">
              {/* Ko'proq yuklash */}
              {messages.length > 0 && messages.length < historyTotal && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? 'Yuklanmoqda...' : `⬆ Oldingi xabarlar (${historyTotal - messages.length} ta)`}
                  </button>
                </div>
              )}

              {/* Xabarlar */}
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <div className="text-5xl">{roomMeta.icon}</div>
                  <p className="text-sm font-medium text-gray-500">
                    {activeRoom.name ?? activeRoom.group?.name ?? 'Chat'}
                  </p>
                  <p className="text-xs text-gray-400">Hali xabarlar yo'q. Birinchi bo'lib yozing!</p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === user?.id}
                    onDelete={handleDelete}
                    showName={shouldShowName(i)}
                  />
                ))
              )}

              {/* Yozmoqda indikatori */}
              {roomTyping.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-0.5 bg-white border border-gray-100 shadow-sm rounded-2xl px-3 py-2">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {roomTyping.map(u => u.userName).join(', ')} yozmoqda...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Kiritish maydoni */}
            <div className="relative shrink-0">
              <MessageInput
                roomId={activeRoom.id}
                readOnly={readOnly}
                onSend={handleSend}
                onTyping={() => sendTyping(activeRoom.id)}
                onStop={() => stopTyping(activeRoom.id)}
              />
            </div>
          </>
        ) : (
          // Xona tanlanmagan holat
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center text-4xl">
              💬
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-gray-500">Xona tanlang</p>
              <p className="text-sm text-gray-400 mt-1">Chap paneldan xona tanlang va suhbatni boshlang</p>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-2xl shadow-xl z-50 flex items-center gap-2">
          {toast}
        </div>
      )}
    </div>
  );
}

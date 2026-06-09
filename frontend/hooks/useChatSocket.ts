'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, TypingUser } from '@/types/chat';

export type ChatSocketEvent =
  | { type: 'new_message';      message: ChatMessage }
  | { type: 'message_deleted';  messageId: string }
  | { type: 'message_read';     messageId: string; userId: string }
  | { type: 'message_blocked';  text: string }
  | { type: 'message_warning';  text: string }
  | { type: 'room_history';     roomId: string; messages: ChatMessage[]; total: number }
  | { type: 'joined_room';      roomId: string };

interface UseChatSocketReturn {
  connected:    boolean;
  lastEvent:    ChatSocketEvent | null;
  typingUsers:  TypingUser[];
  joinRoom:     (roomId: string) => void;
  leaveRoom:    (roomId: string) => void;
  sendMessage:  (payload: { roomId: string; type: string; content?: string; fileUrl?: string; fileSize?: number; durationSeconds?: number }) => void;
  sendTyping:   (roomId: string) => void;
  stopTyping:   (roomId: string) => void;
  markRead:     (roomId: string, messageId: string) => void;
  deleteMsg:    (roomId: string, messageId: string) => void;
}

export function useChatSocket(): UseChatSocketReturn {
  const socketRef    = useRef<Socket | null>(null);
  const [connected,  setConnected]   = useState(false);
  const [lastEvent,  setLastEvent]   = useState<ChatSocketEvent | null>(null);
  const [typingUsers,setTypingUsers] = useState<TypingUser[]>([]);
  const accessToken  = useAuthStore(s => s.accessToken);

  // Typing timeout map
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!accessToken) return;

    const WS = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const socket = io(`${WS}/chat`, {
      auth:       { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => { setConnected(false); setTypingUsers([]); });

    socket.on('new_message',     (data: { message: ChatMessage }) =>
      setLastEvent({ type: 'new_message', message: data.message ?? data }));

    socket.on('message_deleted', (data: { messageId: string }) =>
      setLastEvent({ type: 'message_deleted', messageId: data.messageId }));

    socket.on('message_read',    (data: { messageId: string; userId: string }) =>
      setLastEvent({ type: 'message_read', messageId: data.messageId, userId: data.userId }));

    socket.on('message_blocked', (data: { message: string }) =>
      setLastEvent({ type: 'message_blocked', text: data.message }));

    socket.on('message_warning', (data: { message: string }) =>
      setLastEvent({ type: 'message_warning', text: data.message }));

    socket.on('room_history', (data: { roomId: string; messages: ChatMessage[]; total: number }) =>
      setLastEvent({ type: 'room_history', ...data }));

    socket.on('joined_room', (data: { roomId: string }) =>
      setLastEvent({ type: 'joined_room', roomId: data.roomId }));

    // Yozmoqda indikatori
    socket.on('user_typing', (data: TypingUser) => {
      setTypingUsers(prev => {
        if (prev.find(u => u.userId === data.userId && u.roomId === data.roomId)) return prev;
        return [...prev, data];
      });
      // 3 soniyadan keyin o'chirish
      const key = `${data.userId}-${data.roomId}`;
      const old = typingTimers.current.get(key);
      if (old) clearTimeout(old);
      typingTimers.current.set(key, setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => !(u.userId === data.userId && u.roomId === data.roomId)));
        typingTimers.current.delete(key);
      }, 3000));
    });

    socket.on('user_stop_typing', (data: { userId: string; roomId: string }) => {
      setTypingUsers(prev => prev.filter(u => !(u.userId === data.userId && u.roomId === data.roomId)));
      const key = `${data.userId}-${data.roomId}`;
      const t = typingTimers.current.get(key);
      if (t) { clearTimeout(t); typingTimers.current.delete(key); }
    });

    socketRef.current = socket;
    return () => {
      typingTimers.current.forEach(clearTimeout);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  // String yuboramiz — gateway { roomId } va string ikkalasini ham qabul qiladi
  const joinRoom    = useCallback((roomId: string) => socketRef.current?.emit('join_room', roomId), []);
  const leaveRoom   = useCallback((roomId: string) => socketRef.current?.emit('leave_room', roomId), []);
  const sendMessage = useCallback((payload: object) => socketRef.current?.emit('send_message', payload), []);
  const sendTyping  = useCallback((roomId: string) => socketRef.current?.emit('typing', roomId), []);
  const stopTyping  = useCallback((roomId: string) => socketRef.current?.emit('stop_typing', roomId), []);
  const markRead    = useCallback((roomId: string, messageId: string) => socketRef.current?.emit('mark_read', { roomId, messageId }), []);
  const deleteMsg   = useCallback((roomId: string, messageId: string) => socketRef.current?.emit('delete_message', { roomId, messageId }), []);

  return { connected, lastEvent, typingUsers, joinRoom, leaveRoom, sendMessage, sendTyping, stopTyping, markRead, deleteMsg };
}

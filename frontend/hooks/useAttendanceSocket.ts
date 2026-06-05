'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import type { AttendanceRecord } from '@/types/attendance';

export interface AttendanceSocketEvent {
  type:       'scan' | 'manual' | 'excuse';
  record:     AttendanceRecord;
  lessonId:   string;
}

export function useAttendanceSocket(lessonId: string | null) {
  const [lastEvent, setLastEvent] = useState<AttendanceSocketEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef  = useRef<Socket | null>(null);
  const accessToken = useAuthStore(s => s.accessToken);

  useEffect(() => {
    if (!lessonId || !accessToken) return;

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';

    const socket = io(WS_URL, {
      auth:       { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    });

    socket.on('connect',    () => {
      setConnected(true);
      socket.emit('join-lesson', lessonId);
    });
    socket.on('disconnect', () => setConnected(false));

    // Davomat yangilanganda
    socket.on('attendance:updated', (data: AttendanceSocketEvent) => {
      if (data.lessonId === lessonId) setLastEvent({ ...data, type: 'manual' });
    });
    socket.on('attendance:qr-scan', (data: AttendanceSocketEvent) => {
      if (data.lessonId === lessonId) setLastEvent({ ...data, type: 'scan' });
    });
    socket.on('attendance:excuse', (data: AttendanceSocketEvent) => {
      if (data.lessonId === lessonId) setLastEvent({ ...data, type: 'excuse' });
    });

    socketRef.current = socket;
    return () => {
      socket.emit('leave-lesson', lessonId);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [lessonId, accessToken]);

  return { lastEvent, connected };
}

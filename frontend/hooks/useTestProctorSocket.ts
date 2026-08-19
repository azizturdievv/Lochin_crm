'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

export interface TabSwitchAlert {
  resultId:       string;
  studentId:      string;
  studentName:    string;
  tabSwitchCount: number;
  at:             number;
}

// Nazorat ishi jonli kuzatuvi: "Natijalar" oynasi ochiq turganda o'quvchi
// boshqa tab/oynaga chiqib ketsa, shu hook orqali darhol signal keladi
export function useTestProctorSocket(testId: string | null) {
  const [alerts, setAlerts] = useState<TabSwitchAlert[]>([]);
  const accessToken = useAuthStore(s => s.accessToken);

  useEffect(() => {
    if (!testId || !accessToken) return;

    const WS = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const socket: Socket = io(`${WS}/test-proctor`, {
      auth:       { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay:    2000,
    });

    socket.on('connect', () => socket.emit('watch_test', { testId }));

    socket.on('tab_switch_alert', (data: Omit<TabSwitchAlert, 'at'>) => {
      setAlerts(prev => [{ ...data, at: Date.now() }, ...prev].slice(0, 30));
    });

    return () => {
      socket.emit('unwatch_test', { testId });
      socket.disconnect();
    };
  }, [testId, accessToken]);

  return { alerts };
}

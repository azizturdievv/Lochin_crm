'use client';

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id:      string;
  type:    ToastType;
  message: string;
  // Berilsa — "Qayta urinish" tugmasi ko'rsatiladi, muvaffaqiyatli bo'lsa toast avtomatik yopiladi
  retry?:  () => Promise<unknown> | void;
}

interface ToastState {
  toasts: ToastItem[];
  show:   (t: Omit<ToastItem, 'id'>) => string;
  dismiss:(id: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  show: (t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ toasts: [...get().toasts, { ...t, id }] });

    // success/info avtomatik yopiladi — xato retry kutayotgani uchun ochiq qoladi
    if (t.type !== 'error') {
      setTimeout(() => get().dismiss(id), 4000);
    }
    return id;
  },

  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

// Komponent tashqarisidan (masalan lib/api.ts interceptor'idan) chaqirish uchun
export const toast = {
  success: (message: string) => useToastStore.getState().show({ type: 'success', message }),
  error:   (message: string, retry?: ToastItem['retry']) =>
    useToastStore.getState().show({ type: 'error', message, retry }),
  info:    (message: string) => useToastStore.getState().show({ type: 'info', message }),
};

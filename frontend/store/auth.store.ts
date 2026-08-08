'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  accessToken:     string | null;
  refreshToken:    string | null;
  user:            User | null;
  isAuthenticated: boolean;
  hasHydrated:     boolean;

  setTokens:      (accessToken: string, refreshToken: string) => void;
  setUser:        (user: User) => void;
  logout:         () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken:     null,
      refreshToken:    null,
      user:            null,
      isAuthenticated: false,
      hasHydrated:     false,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () =>
        set({
          accessToken:     null,
          refreshToken:    null,
          user:            null,
          isAuthenticated: false,
        }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name:    'ilm-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      ),
      partialize: (s) => ({
        accessToken:     s.accessToken,
        refreshToken:    s.refreshToken,
        user:            s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

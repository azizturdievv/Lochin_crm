import axios, { type AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

// ─── AXIOS INSTANCE ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── REQUEST: JWT TOKEN QO'SHISH ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── REFRESH TOKEN NAVBATI ────────────────────────────────────────────────────
let isRefreshing   = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject:  (err: unknown) => void;
}> = [];

function processQueue(err: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) =>
    err ? reject(err) : resolve(token!),
  );
  failedQueue = [];
}

// ─── RESPONSE: 401 → TOKEN YANGILASH ─────────────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    // 2FA hali sozlanmagan (SA/Manager, majburiy) — backend TwoFaEnforcementGuard
    // 403 + requiresTwoFaSetup bilan bloklaydi. Tokenlar hali yaroqli, faqat
    // sozlash sahifasiga yo'naltiramiz (login qilib bo'lmaydi holatda ham ishlashi
    // uchun — masalan eski localStorage token bilan to'g'ridan-to'g'ri /dashboard'ga
    // kirilganda ham ushlaydi).
    if (
      error.response?.status === 403 &&
      error.response?.data?.requiresTwoFaSetup &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login/2fa-required'
    ) {
      window.location.href = '/login/2fa-required';
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Refresh token mavjudmi?
    const { refreshToken, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }

    // Parallel so'rovlar uchun navbat
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((newToken) => {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api(original);
      });
    }

    original._retry  = true;
    isRefreshing     = true;

    try {
      const { data } = await axios.post<{ accessToken: string }>(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken },
      );

      const newAccess = data.accessToken;
      setTokens(newAccess, refreshToken);
      processQueue(null, newAccess);

      original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

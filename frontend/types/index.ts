// ─── ROL ────────────────────────────────────────────────────────────────────
export type Role = 'super_admin' | 'manager' | 'ustoz' | 'student';

// ─── FOYDALANUVCHI ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
  isActive: boolean;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  // To'g'ridan-to'g'ri kirish (student/ustoz)
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  // 2FA talab qilinsa
  requires2FA?: boolean;
  twoFAType?: 'sms' | 'totp';
  userId?: string;
}

export interface TwoFARequest {
  userId: string;
  code: string;
}

export interface TwoFAResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  revenue: {
    today: number;
    month: number;
    year: number;
  };
  students: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  debt: {
    total: number;
    count: number;
  };
  attendance: {
    rateToday: number;
    presentToday: number;
    totalToday: number;
  };
}

export interface RecentPayment {
  id: string;
  studentName: string;
  amount: number;
  method: string;
  createdAt: string;
}

export interface AttendanceChartPoint {
  hour: string;
  present: number;
  absent: number;
  late: number;
}

// ─── UMUMIY ──────────────────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

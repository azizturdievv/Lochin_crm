// ─── ROL ────────────────────────────────────────────────────────────────────
export type Role = 'super_admin' | 'manager' | 'ustoz' | 'student';

// ─── FOYDALANUVCHI ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  username?: string | null;
  role: Role;
  avatarUrl?: string | null;
  phone?: string | null;
  isActive: boolean;
  twoFaEnabled?: boolean;
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

export interface TwoFaSetupResponse {
  secret:        string;
  otpAuthUrl:    string;
  qrCodeDataUrl: string;
  message:       string;
}

// ─── DASHBOARD — ADMIN / MANAGER ─────────────────────────────────────────────
export interface AdminDashboard {
  role: 'admin';
  revenue:    { today: number; month: number; year: number };
  students:   { total: number; active: number; newThisMonth: number };
  debt:       { count: number; total: number };
  attendance: { rateToday: number; presentToday: number; totalToday: number };
  revenueChart:   { date: string; amount: number }[];
  recentPayments: { id: string; studentName: string; amount: number; method: string; createdAt: string }[];
  staffKpi:       { id: string; name: string; role: string; groups: number; students: number }[];
}

// ─── DASHBOARD — USTOZ ───────────────────────────────────────────────────────
export interface TeacherDashboard {
  role: 'ustoz';
  groups: {
    id: string; name: string; subjectName: string;
    currentStudents: number; maxStudents: number;
    nextLesson: { date: string; startTime: string; endTime: string } | null;
  }[];
  todayLessons: {
    id: string; groupName: string; subjectName: string;
    startTime: string; endTime: string; room: string | null;
    status: string; present: number; late: number; total: number;
  }[];
  testStats: { totalTests: number; avgScore: number; published: number };
}

// ─── DASHBOARD — STUDENT ─────────────────────────────────────────────────────
export interface StudentDashboard {
  role: 'student';
  totalPoints:    number;
  attendanceRate: number;
  attendedDays:   number;
  totalDays:      number;
  nextLesson: {
    groupName: string; subjectName: string;
    date: string; startTime: string; endTime: string; room: string | null;
  } | null;
  paymentStatus: { paidThisMonth: number; activeEnrollments: number; hasDebt: boolean };
  lastTestResult: { title: string; score: number; earnedPoints: number; finishedAt: string } | null;
}

export type DashboardData = AdminDashboard | TeacherDashboard | StudentDashboard;

// ─── ESKI TIPLAR (backwards compat) ──────────────────────────────────────────
export interface DashboardStats {
  revenue:    { today: number; month: number; year: number };
  students:   { total: number; active: number; newThisMonth: number };
  debt:       { total: number; count: number };
  attendance: { rateToday: number; presentToday: number; totalToday: number };
}
export interface RecentPayment {
  id: string; studentName: string; amount: number; method: string; createdAt: string;
}
export interface AttendanceChartPoint {
  hour: string; present: number; absent: number; late: number;
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

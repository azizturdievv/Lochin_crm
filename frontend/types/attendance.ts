export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'unexcused';

// ─── DAVOMAT YOZUVI ────────────────────────────────────────────────────────────
export interface AttendanceRecord {
  id:             string;
  lessonId:       string;
  studentId:      string;
  student: {
    firstName:  string;
    lastName:   string;
    phone:      string | null;
    avatarUrl?: string | null;
  };
  status:         AttendanceStatus;
  lateMinutes:    number | null;
  scannedAt:      string | null;
  excuseReason:   string | null;
  excuseByParent: boolean;
  parentNotified: boolean;
  createdAt:      string;
}

// ─── DARS DAVOMATI ─────────────────────────────────────────────────────────────
export interface LessonAttendance {
  lesson: {
    id:          string;
    groupId:     string;
    group:       { name: string; subject: { id: string; name: string } };
    teacherId:   string;
    teacher:     { firstName: string; lastName: string };
    lessonDate:  string;
    startTime:   string | null;
    endTime:     string | null;
    status:      string;
    qrCode:      string | null;
    qrExpiresAt: string | null;
  };
  attendance: AttendanceRecord[];
  stats: {
    total:     number;
    present:   number;
    late:      number;
    absent:    number;
    excused:   number;
    unexcused: number;
    rate:      number;
  };
}

// ─── QR KOD ───────────────────────────────────────────────────────────────────
export interface QrData {
  qrImage:   string;     // base64 data URL
  qrPayload: { lessonId: string; date: string; expiresAt: string };
  lesson:    { id: string; groupId: string };
}

// ─── STATIKALAR ────────────────────────────────────────────────────────────────
export const STATUS_META: Record<AttendanceStatus, { label: string; icon: string; cls: string; dot: string }> = {
  present:   { label: 'Keldi',      icon: '✅', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  late:      { label: 'Kech',       icon: '⏰', cls: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500'   },
  absent:    { label: 'Kelmadi',    icon: '❌', cls: 'bg-red-100 text-red-700',         dot: 'bg-red-500'     },
  excused:   { label: 'Sababli',    icon: '📋', cls: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500'    },
  unexcused: { label: 'Sababsiz',   icon: '🚫', cls: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500'    },
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present:   '#10b981',
  late:      '#f59e0b',
  absent:    '#f87171',
  excused:   '#60a5fa',
  unexcused: '#fb7185',
};

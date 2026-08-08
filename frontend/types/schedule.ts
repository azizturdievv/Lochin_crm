// ─── KONSTANTALAR ─────────────────────────────────────────────────────────────
// Xonalar va paralar endi Sozlamalar bo'limida boshqariladi (DB-backed:
// GET /schedule/rooms, /schedule/time-slots) — qattiq kodlangan ro'yxat emas.

export const DAYS_UZ = ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'];
export const DAYS_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

export type LessonStatus = 'scheduled' | 'completed' | 'cancelled' | 'substituted';

// ─── ENTITI ───────────────────────────────────────────────────────────────────
export interface ScheduleLesson {
  id:         string;
  lessonDate: string;
  startTime:  string;
  endTime:    string;
  roomNumber: string;
  status:     LessonStatus;
  topic:      string | null;
  group: {
    id:             string;
    name:           string;
    currentStudents:number;
    maxStudents:    number;
    subject:        { id: string; name: string };
  };
  teacher: {
    id:        string;
    firstName: string;
    lastName:  string;
  };
}

// ─── XONA / PARA (Sozlamalar bo'limidan, DB-backed) ────────────────────────────
export interface ScheduleRoom {
  id: string; name: string; number: string; capacity: number;
  isActive: boolean; orderIndex: number;
}
export interface ScheduleTimeSlotItem {
  id: string; name: string; startTime: string; endTime: string;
  isActive: boolean; orderIndex: number;
}

// ─── API JAVOB ─────────────────────────────────────────────────────────────────
export interface WeekScheduleResponse {
  weekStart: string;
  weekEnd:   string;
  weekDays:  string[];
  grid:      Record<string, Record<string, ScheduleLesson[]>>; // { day: { room: lessons[] } }
  rooms:     ScheduleRoom[];
  timeSlots: ScheduleTimeSlotItem[];
  summary: {
    totalLessons: number;
    freeSlots:    number;
    roomUsage:    { room: string; capacity: number; bookedHours: number; utilization: number }[];
  };
}

export interface FreeSlot {
  room:     string;
  capacity: number;
  slot:     { start: string; end: string };
}

export interface AnalysisData {
  month:          string;
  roomStats:      { room: string; lessonCount: number; totalHours: number; groupCount: number; utilizationPercent: number }[];
  subjectRevenue: { subject: string; students: number; revenue: number }[];
  teacherStats:   { name: string; lessonCount: number; totalHours: number; groupCount: number }[];
  groupFill:      { name: string; subject: string; currentStudents: number; maxStudents: number; fillPercent: number }[];
}

// ─── CONFLICT ─────────────────────────────────────────────────────────────────
export interface ConflictResult {
  hasConflict:      boolean;
  roomConflict:     ScheduleLesson | null;
  teacherConflict:  ScheduleLesson | null;
  capacityConflict: { enrolledCount: number; roomCapacity: number } | null;
}

// ─── STATUS RANGI ─────────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<LessonStatus, { bg: string; border: string; text: string }> = {
  scheduled:   { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800'   },
  completed:   { bg: 'bg-emerald-50',border: 'border-emerald-300',text: 'text-emerald-800' },
  cancelled:   { bg: 'bg-gray-100',  border: 'border-gray-300',   text: 'text-gray-500'   },
  substituted: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800'  },
};

// ─── SUBJECT RANGLARI (fan bo'yicha rang) ────────────────────────────────────
const SUBJECT_PALETTE: { bg: string; borderL: string; text: string }[] = [
  { bg: 'bg-sky-50',    borderL: 'border-l-sky-400',    text: 'text-sky-800'    },
  { bg: 'bg-violet-50', borderL: 'border-l-violet-400', text: 'text-violet-800' },
  { bg: 'bg-rose-50',   borderL: 'border-l-rose-400',   text: 'text-rose-800'   },
  { bg: 'bg-amber-50',  borderL: 'border-l-amber-400',   text: 'text-amber-800'  },
  { bg: 'bg-teal-50',   borderL: 'border-l-teal-400',   text: 'text-teal-800'   },
  { bg: 'bg-orange-50', borderL: 'border-l-orange-400', text: 'text-orange-800' },
  { bg: 'bg-cyan-50',   borderL: 'border-l-cyan-400',   text: 'text-cyan-800'   },
  { bg: 'bg-pink-50',   borderL: 'border-l-pink-400',   text: 'text-pink-800'   },
];

export function subjectColor(subjectId: string): { bg: string; borderL: string; text: string } {
  const hash = subjectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}

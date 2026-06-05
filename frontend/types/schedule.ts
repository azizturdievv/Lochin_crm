// ─── KONSTANTALAR ─────────────────────────────────────────────────────────────
export const ROOMS = [
  { number: '101', capacity: 12 },
  { number: '102', capacity: 12 },
  { number: '103', capacity: 12 },
  { number: '104', capacity: 12 },
  { number: '201', capacity: 32 },
] as const;

export const TIME_SLOTS = [
  { start: '08:00', end: '10:00', label: '1-para', index: 0 },
  { start: '10:05', end: '12:00', label: '2-para', index: 1 },
  { start: '14:00', end: '16:00', label: '3-para', index: 2 },
  { start: '16:05', end: '18:00', label: '4-para', index: 3 },
] as const;

export const DAYS_UZ = ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'];
export const DAYS_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

export type RoomNumber = '101' | '102' | '103' | '104' | '201';
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

// ─── API JAVOB ─────────────────────────────────────────────────────────────────
export interface WeekScheduleResponse {
  weekStart: string;
  weekEnd:   string;
  weekDays:  string[];
  grid:      Record<string, Record<string, ScheduleLesson[]>>; // { day: { room: lessons[] } }
  rooms:     typeof ROOMS[number][];
  timeSlots: typeof TIME_SLOTS[number][];
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
  month:         string;
  totalLessons:  number;
  totalHours:    number;
  avgUtilization:number;
  roomStats:     { room: string; lessons: number; hours: number; utilization: number }[];
  revenueData:   { room: string; revenue: number; potentialRevenue: number }[];
}

// ─── CONFLICT ─────────────────────────────────────────────────────────────────
export interface ConflictResult {
  hasConflict:     boolean;
  roomConflict:    ScheduleLesson | null;
  teacherConflict: ScheduleLesson | null;
}

// ─── STATUS RANGI ─────────────────────────────────────────────────────────────
export const STATUS_COLORS: Record<LessonStatus, { bg: string; border: string; text: string }> = {
  scheduled:   { bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800'   },
  completed:   { bg: 'bg-emerald-50',border: 'border-emerald-300',text: 'text-emerald-800' },
  cancelled:   { bg: 'bg-gray-100',  border: 'border-gray-300',   text: 'text-gray-500'   },
  substituted: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800'  },
};

// ─── SUBJECT RANGLARI (fan bo'yicha rang) ────────────────────────────────────
const SUBJECT_PALETTE = [
  'bg-sky-100 border-sky-300 text-sky-800',
  'bg-violet-100 border-violet-300 text-violet-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-pink-100 border-pink-300 text-pink-800',
];

export function subjectColor(subjectId: string): string {
  const hash = subjectId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
}

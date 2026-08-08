// ─── LEADERBOARD ─────────────────────────────────────────────────────────────
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, BookOpen, Building2, CheckCircle2, FileText, Glasses, Handshake, PenLine, Pencil, Star, Trophy, XCircle } from 'lucide-react';
export interface LeaderboardEntry {
  rank:            number;
  userId:          string;
  firstName:       string;
  lastName:        string;
  avatarUrl:       string | null;
  role:            string;
  totalPoints:     number;
  thisMonthPoints: number;
  streak:          number;
  badgeCount:      number;
}

// ─── BALL TARIXI ─────────────────────────────────────────────────────────────
export type PointReason =
  | 'spelling_clean'  | 'spelling_self_fix' | 'book_test'
  | 'duty'            | 'kpi_100'           | 'referral'
  | 'test_90'         | 'vocab_test'        | 'other'
  | 'spelling_error'  | 'duty_missed';

export interface PointLog {
  id:         string;
  userId:     string;
  points:     number;
  reason:     string;
  reasonType: PointReason;
  metadata?:  Record<string, unknown>;
  createdAt:  string;
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
export interface Badge {
  id:          string;
  name:        string;
  icon: LucideIcon;
  description: string;
  condition:   string;
  earnedAt:    string | null;
  isEarned:    boolean;
}

// ─── KITOBXONLIK ──────────────────────────────────────────────────────────────
export type BookStatus = 'not_started' | 'reading' | 'completed' | 'tested';

export interface Book {
  id:           string;
  title:        string;
  author:       string;
  coverUrl:     string | null;
  description:  string | null;
  pageCount:    number | null;
  testId:       string | null;
  hasTest:      boolean;
  myStatus:     BookStatus;
  myScore:      number | null;
  passScore:    number;
  addedAt:      string;
}

// ─── LUG'AT ───────────────────────────────────────────────────────────────────
export type MasteryLevel = 0 | 1 | 2 | 3;

export interface VocabWord {
  id:             string;
  word:           string;
  translation:    string;
  exampleSentence:string | null;
  aiDefinition:   string | null;
  subjectId:      string | null;
  addedBy:        string;
  masteryLevel:   MasteryLevel;
  testCount:      number;
  nextReviewAt:   string | null;
  createdAt:      string;
}

export interface VocabTestQuestion {
  wordId:   string;
  word:     string;
  options:  string[];
}

// ─── META ─────────────────────────────────────────────────────────────────────
export const POINT_REASON_META: Record<PointReason, { label: string; icon: LucideIcon; sign: '+' | '-' }> = {
  spelling_clean:    { label: 'Xatosiz xabar',       icon: PenLine, sign: '+' },
  spelling_self_fix: { label: 'Xatoni o\'zi tuzatdi', icon: Pencil, sign: '+' },
  book_test:         { label: 'Kitob testi 80%+',     icon: BookOpen, sign: '+' },
  duty:              { label: 'Navbat bajardi',        icon: Building2, sign: '+' },
  kpi_100:           { label: 'KPI 100%',              icon: Trophy, sign: '+' },
  referral:          { label: 'Yangi o\'quvchi',       icon: Handshake, sign: '+' },
  test_90:           { label: 'Test 90%+',             icon: FileText, sign: '+' },
  vocab_test:        { label: 'Lug\'at testi',         icon: BookOpen, sign: '+' },
  other:             { label: 'Boshqa',                icon: Star, sign: '+' },
  spelling_error:    { label: 'Imlo xatosi',           icon: XCircle, sign: '-' },
  duty_missed:       { label: 'Navbat bajarilmadi',    icon: AlertTriangle, sign: '-' },
};

export const MASTERY_META: Record<MasteryLevel, { label: string; color: string; bg: string }> = {
  0: { label: 'Yangi',      color: 'text-gray-600',    bg: 'bg-gray-100'    },
  1: { label: 'O\'rganildi', color: 'text-blue-700',   bg: 'bg-blue-100'    },
  2: { label: 'Yaxshi',     color: 'text-amber-700',   bg: 'bg-amber-100'   },
  3: { label: 'Mustahkam',  color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

export const BOOK_STATUS_META: Record<BookStatus, { label: string; icon: LucideIcon; color: string }> = {
  not_started: { label: 'Boshlanmagan', icon: BookOpen, color: 'text-gray-500'    },
  reading:     { label: 'O\'qilyapti',  icon: Glasses, color: 'text-blue-600'   },
  completed:   { label: 'Tugallandi',   icon: CheckCircle2, color: 'text-emerald-600' },
  tested:      { label: 'Test topshirildi',icon:Star, color: 'text-amber-600' },
};

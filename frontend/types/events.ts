import type { LucideIcon } from 'lucide-react';
import { Activity, Bot, Crown, Dumbbell, Medal, MoreHorizontal, VenetianMask } from 'lucide-react';
export type EventType   = 'olympiad' | 'sport' | 'robotics' | 'chess' | 'running' | 'cultural' | 'other';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
export type CompetitionStatus = 'not_started' | 'ongoing' | 'finished';

export interface CompetitionWinner {
  place:     number;
  name:      string;
  score:     number;
  timeTaken: number | null;
}

export interface CompetitionResults {
  winners:            CompetitionWinner[];
  totalParticipants:  number;
  finishedAt:         string;
}

export interface CrmEvent {
  id:                   string;
  title:                string;
  type:                 EventType;
  description:          string | null;
  eventDate:            string;
  location:             string | null;
  maxParticipants:      number | null;
  registrationDeadline: string | null;
  hasFee:               boolean;
  feeAmount:            number | null;
  status:               EventStatus;
  participantsCount:    number;
  myParticipation:      EventParticipant | null;
  createdBy:            string;
  organizer?:           { firstName: string; lastName: string };
  createdAt:            string;
  // Onlayn musobaqa
  isOnline:             boolean;
  questionCount:        number;
  timeLimit:            number;
  competitionStatus:    CompetitionStatus;
  results:              CompetitionResults | null;
}

export interface QuestionOption {
  id:   string;
  text: string;
}

export interface EventQuestion {
  id:            string;
  eventId:       string;
  question:      string;
  options:       QuestionOption[];
  correctAnswer: string;
  points:        number;
  sortOrder:     number;
}

// ─── ISHTIROKCHI TOMONIDAN TEST YECHISH (to'g'ri javobsiz) ────────────────────
export interface CompetitionQuestion {
  id:       string;
  question: string;
  options:  QuestionOption[];
  points:   number;
}

export interface CompetitionStartResponse {
  questions: CompetitionQuestion[];
  timeLimit: number; // daqiqada
  startedAt: string;
}

export interface CompetitionSubmitResponse {
  score:        number;
  totalPoints:  number;
  correctCount: number;
}

// ─── JONLI REYTING ─────────────────────────────────────────────────────────
export interface LeaderboardEntry {
  rank:          number | null;
  participantId: string;
  studentName:   string;
  score:         number | null;
  timeTaken:     number | null;
  submittedAt:   string | null;
}

export interface LeaderboardResponse {
  participants:    LeaderboardEntry[];
  totalSubmitted:  number;
  totalRegistered: number;
}

export type ParticipantPaymentStatus = 'pending' | 'paid' | 'free';

// Xom EventParticipant entity shakli (backend transformatsiyasiz qaytaradi)
export interface EventParticipant {
  id:               string;
  eventId:          string;
  studentId:        string;
  student?:         { id: string; firstName: string; lastName: string; phone: string | null; role: string };
  phone:            string | null;
  school:           string | null;
  grade:            string | null;
  age:              number | null;
  paymentStatus:    ParticipantPaymentStatus;
  permitCode:       string | null;
  permitQr:         string | null;
  permitVerified:   boolean;
  permitVerifiedAt: string | null;
  place:            number | null;
  score:            number | null;
  registeredAt:     string;
}

export interface Certificate {
  id:               string;
  studentId:        string;
  student?:         { id: string; firstName: string; lastName: string };
  type:             'completion' | 'achievement' | 'participation' | 'diploma';
  title:            string;
  eventId:          string | null;
  fileUrl:          string | null;
  verificationCode: string;
  issuedAt:         string;
  isSent:           boolean;
}

// ─── META ─────────────────────────────────────────────────────────────────────
export const EVENT_TYPE_META: Record<EventType, { label: string; icon: LucideIcon; color: string; bg: string }> = {
  olympiad: { label: 'Olimpiada',      icon: Medal, color: 'text-amber-700',   bg: 'bg-amber-50'   },
  sport:    { label: 'Sport',          icon: Dumbbell, color: 'text-blue-700',    bg: 'bg-blue-50'    },
  robotics: { label: 'Robototexnika',  icon: Bot, color: 'text-purple-700',  bg: 'bg-purple-50'  },
  chess:    { label: 'Shaxmat',        icon: Crown, color: 'text-gray-700',    bg: 'bg-gray-100'   },
  running:  { label: 'Yugurish',       icon: Activity, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  cultural: { label: 'Madaniy',        icon: VenetianMask, color: 'text-rose-700',    bg: 'bg-rose-50'    },
  other:    { label: 'Boshqa',         icon: MoreHorizontal, color: 'text-slate-700',   bg: 'bg-slate-50'   },
};

export const EVENT_STATUS_META: Record<EventStatus, { label: string; color: string; bg: string }> = {
  upcoming:  { label: 'Rejalashtirilgan', color: 'text-blue-700',    bg: 'bg-blue-50'    },
  ongoing:   { label: 'Davom etmoqda',    color: 'text-emerald-700', bg: 'bg-emerald-50' },
  completed: { label: 'Yakunlandi',       color: 'text-gray-600',    bg: 'bg-gray-100'   },
  cancelled: { label: 'Bekor qilindi',    color: 'text-red-700',     bg: 'bg-red-50'     },
};

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export type EventType   = 'olympiad' | 'sport' | 'robotics' | 'chess' | 'running' | 'cultural';
export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

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
}

export interface EventParticipant {
  id:              string;
  eventId:         string;
  userId:          string;
  user?:           { id: string; firstName: string; lastName: string; phone: string | null; role: string };
  hasPaid:         boolean;
  paidAt:          string | null;
  permissionQrUrl: string | null;
  certificateUrl:  string | null;
  rank:            number | null;
  registeredAt:    string;
}

// ─── META ─────────────────────────────────────────────────────────────────────
export const EVENT_TYPE_META: Record<EventType, { label: string; icon: string; color: string; bg: string }> = {
  olympiad: { label: 'Olimpiada',      icon: '🏅', color: 'text-amber-700',   bg: 'bg-amber-50'   },
  sport:    { label: 'Sport',          icon: '⚽', color: 'text-blue-700',    bg: 'bg-blue-50'    },
  robotics: { label: 'Robototexnika',  icon: '🤖', color: 'text-purple-700',  bg: 'bg-purple-50'  },
  chess:    { label: 'Shaxmat',        icon: '♟️', color: 'text-gray-700',    bg: 'bg-gray-100'   },
  running:  { label: 'Yugurish',       icon: '🏃', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  cultural: { label: 'Madaniy',        icon: '🎭', color: 'text-rose-700',    bg: 'bg-rose-50'    },
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

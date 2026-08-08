export type LiveSessionType = 'teacher_student' | 'staff' | 'parent_center' | 'competition' | 'sport_robo' | 'broadcast';
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface LiveSession {
  id:            string;
  title:         string;
  type:          LiveSessionType;
  status:        LiveSessionStatus;
  hostId:        string;
  host?:         { id: string; firstName: string; lastName: string };
  groupId:       string | null;
  group?:        { id: string; name: string } | null;
  roomId:        string | null;
  scheduledAt:   string;
  startedAt:     string | null;
  endedAt:       string | null;
  recordingUrl:  string | null;
  maxParticipants: number;
  createdAt:     string;
}

export interface JoinLiveSessionResponse {
  token:   string;
  url:     string;
  session: LiveSession;
}

// Hozircha faqat "Ustoz-O'quvchi" turi UI orqali yaratiladi (1-bosqich ko'lami);
// qolgan 5 turi backend/entity'da tayyor, keyingi bosqichda UI'ga qo'shiladi
export const LIVE_SESSION_TYPE_META: Record<LiveSessionType, { label: string }> = {
  teacher_student: { label: "Ustoz-O'quvchi" },
  staff:            { label: 'Xodimlar' },
  parent_center:    { label: 'Ota-ona-Markaz' },
  competition:      { label: 'Musobaqa zali' },
  sport_robo:       { label: 'Sport/Robo' },
  broadcast:        { label: 'Jonli efir' },
};

export const LIVE_SESSION_STATUS_META: Record<LiveSessionStatus, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Rejalashtirilgan', color: 'text-blue-700',  bg: 'bg-blue-100' },
  live:      { label: 'Jonli',            color: 'text-red-700',   bg: 'bg-red-100' },
  ended:     { label: 'Yakunlangan',      color: 'text-gray-600',  bg: 'bg-gray-100' },
  cancelled: { label: 'Bekor qilingan',   color: 'text-gray-500',  bg: 'bg-gray-100' },
};

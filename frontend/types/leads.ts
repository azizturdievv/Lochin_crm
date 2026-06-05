export type LeadStage =
  | 'new'
  | 'contacted'
  | 'waiting'
  | 'trial'
  | 'enrolled'
  | 'lost';

export type LeadSource =
  | 'instagram'
  | 'telegram'
  | 'call'
  | 'website'
  | 'whatsapp'
  | 'walk_in';

export interface Lead {
  id:          string;
  firstName:   string;
  lastName:    string;
  phone:       string;
  source:      LeadSource;
  stage:       LeadStage;
  assignedTo:  string | null;
  assignee?:   { id: string; firstName: string; lastName: string } | null;
  notes?:      LeadNote[];
  subject?:    string | null;
  age?:        number | null;
  parentName?: string | null;
  parentPhone?:string | null;
  lostReason?: string | null;
  createdAt:   string;
  updatedAt:   string;
  // 15 daqiqa qoidasi uchun
  firstResponseAt?: string | null;
}

export interface LeadNote {
  id:        string;
  leadId:    string;
  text:      string;
  createdBy: string;
  author?:   { firstName: string; lastName: string };
  createdAt: string;
}

export interface LeadStats {
  total:       number;
  byStage:     Record<LeadStage, number>;
  bySource:    Record<LeadSource, number>;
  conversionRate: number;
  avgResponseMinutes: number;
  alertCount:  number;
}

// Stage meta
export const STAGE_META: Record<LeadStage, { label: string; color: string; bg: string; border: string }> = {
  new:       { label: 'Yangi',         color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  contacted: { label: 'Suhbatda',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200'  },
  waiting:   { label: 'Kutmoqda',      color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  trial:     { label: 'Sinov darsi',   color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200'},
  enrolled:  { label: "O'quvchi",      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200'  },
  lost:      { label: 'Yo\'qotildi',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200'    },
};

// Manba meta
export const SOURCE_META: Record<LeadSource, { label: string; icon: string }> = {
  instagram: { label: 'Instagram',  icon: '📸' },
  telegram:  { label: 'Telegram',   icon: '✈️' },
  call:      { label: "Qo'ng'iroq", icon: '📞' },
  website:   { label: 'Website',    icon: '🌐' },
  whatsapp:  { label: 'WhatsApp',   icon: '💬' },
  walk_in:   { label: 'Walk-in',    icon: '🚶' },
};

export const STAGE_ORDER: LeadStage[] = ['new', 'contacted', 'waiting', 'trial', 'enrolled', 'lost'];

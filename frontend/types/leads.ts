import type { LucideIcon } from 'lucide-react';
import { Footprints, Globe, Instagram, MessageCircle, Phone, Send, UserPlus } from 'lucide-react';
export type LeadStage =
  | 'new'
  | 'in_talk'
  | 'waiting'
  | 'trial'
  | 'enrolled'
  | 'lost';

export type LeadSource =
  | 'instagram'
  | 'telegram'
  | 'phone'
  | 'website'
  | 'whatsapp'
  | 'walkin'
  | 'referral';

export interface Lead {
  id:                string;
  fullName:          string;
  phone:             string;
  email?:            string | null;
  source:            LeadSource | null;
  stage:             LeadStage;
  assignedToId?:     string | null;
  assignedTo?:       { id?: string; firstName: string; lastName: string } | null;
  notes?:            LeadNote[];
  interestedSubject?: string | null;
  lostReason?:       string | null;
  trialDate?:        string | null;
  alert15minSent?:   boolean;
  createdAt:         string;
  updatedAt:         string;
  // 15 daqiqa qoidasi uchun
  firstContactAt?:   string | null;
}

export interface LeadNote {
  id:        string;
  leadId:    string;
  content:   string;
  createdById: string;
  createdBy?: { firstName: string; lastName: string };
  stageFrom?: string | null;
  stageTo?:   string | null;
  createdAt: string;
}

export interface LeadStats {
  total:       number;
  byStage:     Record<LeadStage, number>;
  conversionRate: number;
  lostCount:   number;
}

// Stage meta
export const STAGE_META: Record<LeadStage, { label: string; color: string; bg: string; border: string; borderTop: string }> = {
  new:       { label: 'Yangi',         color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   borderTop: 'border-t-blue-400'   },
  in_talk:   { label: 'Suhbatda',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  borderTop: 'border-t-amber-400'  },
  waiting:   { label: 'Kutmoqda',      color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200',  borderTop: 'border-t-slate-400'  },
  trial:     { label: 'Sinov darsi',   color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', borderTop: 'border-t-purple-400' },
  enrolled:  { label: "O'quvchi",      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  borderTop: 'border-t-green-400'  },
  lost:      { label: 'Yo\'qotildi',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    borderTop: 'border-t-red-400'    },
};

// Manba meta
export const SOURCE_META: Record<LeadSource, { label: string; icon: LucideIcon }> = {
  instagram: { label: 'Instagram',  icon: Instagram },
  telegram:  { label: 'Telegram',   icon: Send },
  phone:     { label: "Qo'ng'iroq", icon: Phone },
  website:   { label: 'Website',    icon: Globe },
  whatsapp:  { label: 'WhatsApp',   icon: MessageCircle },
  walkin:    { label: 'Walk-in',    icon: Footprints },
  referral:  { label: 'Referral',   icon: UserPlus },
};

export const STAGE_ORDER: LeadStage[] = ['new', 'in_talk', 'waiting', 'trial', 'enrolled', 'lost'];

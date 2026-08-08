import type { LucideIcon } from 'lucide-react';
import {
  ClipboardCheck, Wallet, FileText, BookOpen, Calendar,
  Megaphone, Cake, AlertTriangle, Settings,
} from 'lucide-react';

export type NotificationType =
  | 'attendance' | 'payment' | 'test' | 'homework' | 'schedule'
  | 'announcement' | 'birthday' | 'emergency' | 'system';

export interface Notification {
  id:        string;
  type:      NotificationType;
  title:     string;
  body:      string;
  isRead:    boolean;
  readAt:    string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items:       Notification[];
  total:       number;
  page:        number;
  limit:       number;
  unreadCount: number;
}

export const NOTIFICATION_TYPE_META: Record<NotificationType, { icon: LucideIcon; label: string; color: string }> = {
  attendance:   { icon: ClipboardCheck, label: 'Davomat',      color: 'text-blue-600 bg-blue-50' },
  payment:      { icon: Wallet,         label: "To'lov",       color: 'text-emerald-600 bg-emerald-50' },
  test:         { icon: FileText,       label: 'Test',         color: 'text-purple-600 bg-purple-50' },
  homework:     { icon: BookOpen,       label: 'Vazifa',       color: 'text-amber-600 bg-amber-50' },
  schedule:     { icon: Calendar,       label: 'Jadval',       color: 'text-sky-600 bg-sky-50' },
  announcement: { icon: Megaphone,      label: "E'lon",        color: 'text-indigo-600 bg-indigo-50' },
  birthday:     { icon: Cake,           label: "Tug'ilgan kun",color: 'text-pink-600 bg-pink-50' },
  emergency:    { icon: AlertTriangle,  label: 'Favqulodda',   color: 'text-red-600 bg-red-50' },
  system:       { icon: Settings,       label: 'Tizim',        color: 'text-gray-600 bg-gray-100' },
};

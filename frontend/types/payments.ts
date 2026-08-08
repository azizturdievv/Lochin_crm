import type { LucideIcon } from 'lucide-react';
import { Banknote, CreditCard, Landmark, Shuffle, Smartphone, Zap } from 'lucide-react';
export type PaymentMethod = 'cash' | 'card' | 'bank' | 'payme' | 'click' | 'mixed';
export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'cancelled';
export type PaymentType   = 'tuition' | 'registration' | 'book' | 'other';

export interface Payment {
  id:             string;
  studentId:      string;
  student:        { firstName: string; lastName: string; phone: string | null };
  amount:         number;
  method:         PaymentMethod;
  status:         PaymentStatus;
  type:           PaymentType;
  paymentMonth:   string | null;
  notes:          string | null;
  cashBreakdown:  Record<string, number> | null;
  cashAmount:     number | null;
  cardAmount:     number | null;
  printedAt:      string | null;
  receivedBy:     { firstName: string; lastName: string };
  createdAt:      string;
}

export interface PaymentsResponse {
  data:        Payment[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
}

export interface AccessStatus {
  isLocked:      boolean;
  isDebtor:      boolean;
  daysOverdue:   number;
  extendedUntil: string | null;
}

export interface Debtor {
  studentId:        string;
  studentName:      string;
  phone:            string | null;
  debtAmount:       number;
  debtMonths:       number;
  lastPaymentDate:  string | null;
  isCritical:       boolean;
  groups:           string[];
}

export interface InstallmentSchedule {
  part:     number;
  amount:   number;
  dueDate:  string;
  isPaid:   boolean;
  paidAt:   string | null;
}

export interface InstallmentPlan {
  id:           string;
  studentId:    string;
  student?:     { id: string; firstName: string; lastName: string };
  totalAmount:  number;
  partsCount:   number;
  paidCount:    number;
  schedule:     InstallmentSchedule[];
  description:  string | null;
  createdAt:    string;
}

export interface CashSession {
  id:              string;
  cashierId:       string;
  cashier:         { firstName: string; lastName: string };
  openingBalance:  number;
  closingBalance:  number | null;
  totalCollected:  number;
  status:          'open' | 'closed';
  openedAt:        string;
  closedAt:        string | null;
  difference:      number | null;
}

export interface CashBreakdown {
  '200000': number;
  '100000': number;
  '50000':  number;
  '10000':  number;
  '5000':   number;
}

export const CASH_DENOMINATIONS = [200_000, 100_000, 50_000, 10_000, 5_000] as const;

export const METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon; color: string }> = {
  cash:  { label: 'Naqd',   icon: Banknote, color: 'emerald' },
  card:  { label: 'Karta',  icon: CreditCard, color: 'blue'    },
  bank:  { label: 'Bank',   icon: Landmark, color: 'purple'  },
  payme: { label: 'Payme',  icon: Smartphone, color: 'cyan'    },
  click: { label: 'Click',  icon: Zap, color: 'orange'  },
  mixed: { label: 'Aralash',icon: Shuffle, color: 'amber'   },
};

// To'lov usuli chip rangi — Tailwind statik tahlili uchun to'liq klass nomlari
export const METHOD_CHIP_CLS: Record<PaymentMethod, string> = {
  cash:  'bg-emerald-100 text-emerald-700',
  card:  'bg-blue-100 text-blue-700',
  bank:  'bg-purple-100 text-purple-700',
  payme: 'bg-cyan-100 text-cyan-700',
  click: 'bg-orange-100 text-orange-700',
  mixed: 'bg-amber-100 text-amber-700',
};

export const STATUS_META: Record<PaymentStatus, { label: string; cls: string }> = {
  completed:  { label: 'Bajarildi',   cls: 'bg-emerald-100 text-emerald-700' },
  pending:    { label: 'Kutilmoqda',  cls: 'bg-amber-100 text-amber-700'     },
  refunded:   { label: 'Qaytarildi',  cls: 'bg-blue-100 text-blue-700'       },
  cancelled:  { label: 'Bekor',       cls: 'bg-red-100 text-red-600'         },
};

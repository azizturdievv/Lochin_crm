// ─── KPI ──────────────────────────────────────────────────────────────────────
import type { LucideIcon } from 'lucide-react';
import { Briefcase, Building2, Lightbulb, Megaphone, Monitor, Package, Pin } from 'lucide-react';
export interface KpiData {
  month:              string;
  totalIncome:        number;
  totalExpenses:      number;
  expensesBreakdown:  { operational: number; salaries: number };
  netProfit:          number;
  marginPercent:      number;
  activeStudents:     number;
  debtorCount:        number;
  debtAmount:         number;
}

// ─── P&L ──────────────────────────────────────────────────────────────────────
export interface MonthlyPnl extends KpiData {
  income: {
    byMethod:  { method: string; total: number; count: number }[];
    byType:    { type: string;   total: number; count: number }[];
    bySubject: { subjectName: string; total: number }[];
  };
  expenses: {
    byCategory: { category: string; total: number }[];
  };
}

export interface AnnualPnl {
  year:        string;
  months:      KpiData[];
  annualTotal: { income: number; expenses: number; netProfit: number; marginPercent: number };
}

// ─── FAN DAROMADI ─────────────────────────────────────────────────────────────
export interface SubjectRevenue {
  year:    string;
  monthly: { month: string; subjects: { subjectName: string; total: number }[] }[];
  annual:  { subjectName: string; total: number }[];
}

// ─── ISH HAQI ─────────────────────────────────────────────────────────────────
export type SalaryStatus = 'calculated' | 'approved' | 'paid';

export interface SalaryRecord {
  id:           string;
  teacherId:    string;
  teacher:      { id: string; firstName: string; lastName: string; role: string };
  periodMonth:  string;
  baseAmount:   number;
  kpiBonus:     number;
  subAmount:    number;
  deduction:    number;
  totalAmount:  number;
  lessonsCount: number;
  totalHours:   number;
  status:       SalaryStatus;
  approvedBy?:  { firstName: string; lastName: string } | null;
}

// ─── XARAJAT ──────────────────────────────────────────────────────────────────
export type ExpenseCategory = 'salary'|'rent'|'utilities'|'supplies'|'marketing'|'equipment'|'other';

export interface Expense {
  id:             string;
  title:          string;
  category:       ExpenseCategory;
  amount:         number;
  expenseDate:    string;
  description:    string | null;
  isConfidential: boolean;
  createdAt:      string;
}

// ─── CHORAK MUKOFOT ───────────────────────────────────────────────────────────
export interface QuarterBonus {
  year:               string;
  quarter:            number;
  period:             string[];
  coefficientPerPoint:number;
  totalBonusFund:     number;
  staff: Array<{
    rank:         number;
    userId:       string;
    name:         string;
    role:         string;
    totalPoints:  number;
    bonusAmount:  number;
  }>;
}

// ─── KONSTANTALAR ─────────────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: LucideIcon; color: string }> = {
  salary:    { label: 'Ish haqi',    icon: Briefcase, color: 'bg-blue-100 text-blue-700'    },
  rent:      { label: 'Ijara',       icon: Building2, color: 'bg-purple-100 text-purple-700'},
  utilities: { label: 'Kommunal',    icon: Lightbulb, color: 'bg-amber-100 text-amber-700'  },
  supplies:  { label: 'Material',    icon: Package, color: 'bg-orange-100 text-orange-700'},
  marketing: { label: 'Marketing',   icon: Megaphone, color: 'bg-pink-100 text-pink-700'    },
  equipment: { label: 'Jihozlar',    icon: Monitor, color: 'bg-teal-100 text-teal-700'   },
  other:     { label: 'Boshqa',      icon: Pin, color: 'bg-gray-100 text-gray-700'    },
};

export const SALARY_STATUS: Record<SalaryStatus, { label: string; cls: string }> = {
  calculated: { label: 'Hisoblandi',  cls: 'bg-amber-100 text-amber-700'    },
  approved:   { label: 'Tasdiqlandi', cls: 'bg-blue-100 text-blue-700'      },
  paid:       { label: "To'landi",    cls: 'bg-emerald-100 text-emerald-700'},
};

// Raqam formatlash
export function fmtM(n: number): string {
  if (n >= 1_000_000_000) return `${(n/1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n/1_000).toFixed(0)}K`;
  return String(n);
}

export const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];

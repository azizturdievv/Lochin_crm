export type StaffRole = 'manager' | 'ustoz';

export interface StaffMember {
  id:           string;
  firstName:    string;
  lastName:     string;
  middleName:   string | null;
  email:        string;
  username:     string | null;
  phone:        string | null;
  role:         StaffRole;
  isActive:     boolean;
  avatarUrl:    string | null;
  lastLoginAt:  string | null;
  totalPoints:  number;
  twoFaEnabled: boolean;
  createdAt:    string;
}

export interface StaffQuery {
  search?:   string;
  role?:     StaffRole;
  isActive?: boolean;
  page:      number;
  limit:     number;
}

export interface StaffResponse {
  data:       StaffMember[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export const STAFF_ROLE_META: Record<StaffRole, { label: string; color: string; bg: string }> = {
  manager: { label: 'Manager',  color: 'text-blue-700',    bg: 'bg-blue-100'    },
  ustoz:   { label: 'Ustoz',    color: 'text-sky-700',     bg: 'bg-sky-100'     },
};

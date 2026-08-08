import type { Role } from './index';

export interface Permission {
  id:          string;
  action:      string;
  module:      string;
  displayName: string;
  description: string | null;
}

export interface PermissionMatrixEntry extends Permission {
  grants: Record<Role, boolean>;
}

export interface PermissionMatrixModule {
  module:      string;
  permissions: PermissionMatrixEntry[];
}

export interface PermissionMatrixResponse {
  roles:   Role[];
  modules: PermissionMatrixModule[];
}

export interface MatrixChange {
  role:         Role;
  permissionId: string;
  granted:      boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  manager:     'Manager',
  ustoz:       'Ustoz',
  student:     "O'quvchi",
};

export const MODULE_LABELS: Record<string, string> = {
  student:      "O'quvchilar",
  payment:      "To'lovlar",
  attendance:   'Davomat',
  schedule:     'Jadval',
  lms:          'LMS',
  crm:          'Lidlar',
  finance:      'Moliya',
  chat:         'Chat',
  gamification: 'Gamifikatsiya',
  events:       'Tadbirlar',
  quality:      'Sifat nazorati',
  substitution: "O'rinbosarlik",
  settings:     'Sozlamalar',
};

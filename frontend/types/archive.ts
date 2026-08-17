export type ArchiveEntityType = 'student' | 'teacher' | 'manager' | 'group';
export type ArchiveType = 'deleted' | 'inactive';

export interface ArchivedUserItem {
  id:          string;
  firstName:   string;
  lastName:    string;
  middleName:  string | null;
  username:    string | null;
  email:       string | null;
  phone:       string | null;
  role:        string;
  archiveType: ArchiveType;
  archivedAt:  string;
}

export interface ArchivedGroupItem {
  id:              string;
  name:            string;
  subject:         { id: string; name: string } | null;
  teacher:         { id: string; firstName: string; lastName: string } | null;
  roomNumber:      string | null;
  currentStudents: number;
  archiveType:     ArchiveType;
  archivedAt:      string;
}

export type ArchivedItem = ArchivedUserItem | ArchivedGroupItem;

export interface ArchivedUserDetail extends ArchivedUserItem {
  isActive:             boolean;
  deletedAt:            string | null;
  createdAt:            string;
  updatedAt:            string;
  lastLoginAt:          string | null;
  avatarUrl:            string | null;
  birthDate:            string | null;
  address:              string | null;
  schoolName:           string | null;
  schoolGrade:          string | null;
  referralSource:       string | null;
  referralPerson:       string | null;
  notes:                string | null;
  totalPoints:          number;
  paymentExtendedUntil: string | null;
}

export interface ArchivedGroupDetail extends ArchivedGroupItem {
  teacher:         { id: string; firstName: string; lastName: string; phone: string | null } | null;
  lessonTime:      { start: string; end: string } | null;
  lessonDays:      string[];
  lessonHours:     number;
  monthlyPrice:    number;
  maxStudents:     number;
  startedAt:       string | null;
  endedAt:         string | null;
  isActive:        boolean;
  createdAt:       string;
}

export type ArchivedDetail = ArchivedUserDetail | ArchivedGroupDetail;

export interface ArchiveListResponse {
  data:       ArchivedItem[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface AuditLogEntry {
  id:         string;
  userId:     string | null;
  userRole:   string | null;
  userEmail:  string | null;
  action:     string;
  entityName: string | null;
  entityId:   string | null;
  oldValues:  Record<string, unknown> | null;
  newValues:  Record<string, unknown> | null;
  createdAt:  string;
}

export interface AuditLogResponse {
  data:  AuditLogEntry[];
  total: number;
  page:  number;
  limit: number;
}

export const ARCHIVE_TABS: { value: ArchiveEntityType; label: string }[] = [
  { value: 'student', label: "O'quvchilar" },
  { value: 'teacher', label: "O'qituvchilar" },
  { value: 'manager', label: 'Menejerlar' },
  { value: 'group',   label: 'Guruhlar' },
];

export const ARCHIVE_TYPE_META: Record<ArchiveType, { label: string; cls: string }> = {
  deleted:  { label: "To'liq o'chirilgan", cls: 'bg-red-100 text-red-700' },
  inactive: { label: 'Nofaol qilingan',    cls: 'bg-amber-100 text-amber-700' },
};

// Audit log action nomlarini o'zbekcha o'qiladigan qilib beradi
export const ACTION_LABELS: Record<string, string> = {
  STUDENT_CREATED:   "O'quvchi yaratildi",
  STUDENT_UPDATED:   "O'quvchi ma'lumoti o'zgartirildi",
  STUDENT_DELETED:   "O'quvchi arxivlandi",
  RESTORE_STUDENT:   "O'quvchi tiklandi",
  CREATE_STAFF:      'Xodim yaratildi',
  UPDATE_STAFF:      "Xodim ma'lumoti o'zgartirildi",
  ACTIVATE_STAFF:    'Xodim faollashtirildi',
  DEACTIVATE_STAFF:  'Xodim nofaollashtirildi',
  DELETE_STAFF:      'Xodim arxivlandi',
  RESTORE_STAFF:     'Xodim tiklandi',
  GROUP_CREATED:     'Guruh yaratildi',
  GROUP_UPDATED:     "Guruh ma'lumoti o'zgartirildi",
  GROUP_DEACTIVATED: 'Guruh arxivlandi',
  GROUP_RESTORED:    'Guruh tiklandi',
};

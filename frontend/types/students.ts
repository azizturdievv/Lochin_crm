// ─── O'QUVCHI ─────────────────────────────────────────────────────────────────
export interface Student {
  id:              string;
  firstName:       string;
  lastName:        string;
  middleName:      string | null;
  email:           string | null;
  username:        string | null;
  phone:           string | null;
  birthDate:       string | null;
  isActive:        boolean;
  totalPoints:     number;
  avatarUrl:       string | null;
  createdAt:       string;
  address:         string | null;
  schoolName:      string | null;
  schoolGrade:     number | null;
  referralSource:  string | null;
  referralPerson:  string | null;
  notes:           string | null;
}

export interface StudentDetail extends Student {
  parents:     ParentRecord[];
  enrollments: EnrollmentRecord[];
  balance:     number | null;
}

// ─── OTA-ONA ──────────────────────────────────────────────────────────────────
export interface ParentRecord {
  id:             string;
  fullName:       string;
  phone:          string;
  phone2:         string | null;
  relation:       string | null;
  isPrimary:      boolean;
  telegramChatId: string | null;
}

// ─── GURUH YOZUVI ─────────────────────────────────────────────────────────────
export interface EnrollmentRecord {
  id:             string;
  groupId:        string;
  group: {
    id:      string;
    name:    string;
    subject: { id: string; name: string };
  };
  status:          'active' | 'paused' | 'completed' | 'dropped';
  enrolledAt:      string;
  discountPercent: number;
}

// ─── FORMA ────────────────────────────────────────────────────────────────────
export interface CreateStudentForm {
  firstName:       string;
  lastName:        string;
  middleName?:     string;
  username?:       string;
  email?:          string;
  phone?:          string;
  password:        string;
  birthDate?:      string;
  address?:        string;
  schoolName?:     string;
  schoolGrade?:    number;
  groupIds?:       string[];
  enrollmentDate?: string;
  referralSource?: string;
  referralPerson?: string;
  notes?:          string;
  parents?:        { fullName: string; phone: string; relation?: string; isPrimary?: boolean }[];
}

export interface UpdateStudentForm {
  firstName?:      string;
  lastName?:       string;
  middleName?:     string;
  email?:          string;
  phone?:          string;
  isActive?:       boolean;
  address?:        string;
  schoolName?:     string;
  schoolGrade?:    number;
  notes?:          string;
}

// ─── RO'YXAT SO'ROV ────────────────────────────────────────────────────────────
export interface StudentQuery {
  search?:    string;
  groupId?:   string;
  isActive?:  boolean;
  hasDebt?:   boolean;
  page:       number;
  limit:      number;
  sortBy?:    string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface StudentsResponse {
  data:       Student[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

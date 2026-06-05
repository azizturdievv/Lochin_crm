// ─── FAN ──────────────────────────────────────────────────────────────────────
export interface Subject {
  id:          string;
  name:        string;
  icon:        string;
  color:       string;
  description: string | null;
  isActive:    boolean;
  order:       number;
  stats?: {
    materialsCount: number;
    testsCount:     number;
    homeworkCount:  number;
    avgScore:       number | null;
  };
}

// ─── MATERIAL ─────────────────────────────────────────────────────────────────
export type MaterialType = 'pdf' | 'video' | 'audio' | 'link' | 'image';

export interface Material {
  id:          string;
  subjectId:   string;
  groupId:     string | null;
  title:       string;
  type:        MaterialType;
  fileUrl:     string;
  fileSize:    number | null;
  durationSec: number | null;
  description: string | null;
  uploadedBy:  string;
  uploader?:   { firstName: string; lastName: string };
  lessonDate:  string | null;
  downloads:   number;
  createdAt:   string;
}

// ─── TEST ─────────────────────────────────────────────────────────────────────
export type TestStatus    = 'draft' | 'review' | 'published' | 'archived';
export type TestDifficulty= 'easy' | 'medium' | 'hard';
export type RetryPolicy   = 'best' | 'average' | 'last';

export interface Test {
  id:              string;
  subjectId:       string;
  groupId:         string | null;
  title:           string;
  status:          TestStatus;
  durationMinutes: number;
  totalQuestions:  number;
  passScore:       number;
  retryPolicy:     RetryPolicy;
  retryCount:      number;
  dueDate:         string | null;
  createdBy:       string;
  creator?:        { firstName: string; lastName: string };
  myResult?:       TestResult | null;
  myAttemptsLeft?: number;
  createdAt:       string;
}

export interface TestQuestion {
  id:         string;
  testId:     string;
  text:       string;
  options:    string[];
  difficulty: TestDifficulty;
  order:      number;
}

export interface TestResult {
  id:              string;
  testId:          string;
  studentId:       string;
  score:           number;
  passed:          boolean;
  timeSpentSec:    number;
  answers:         Record<string, number>;
  anticheatFlags?: AnticheatFlag[];
  categoryScores?: Record<string, number>;
  createdAt:       string;
}

export interface AnticheatFlag {
  type:      'tab_switch' | 'fast_answer' | 'copy_pattern' | 'idle_spike';
  count:     number;
  severity:  'low' | 'medium' | 'high';
  details?:  string;
}

// Test topshirish payload
export interface SubmitTestPayload {
  testId:       string;
  answers:      Record<string, number>;
  timeSpentSec: number;
  tabSwitches:  number;
}

// ─── VAZIFA ───────────────────────────────────────────────────────────────────
export type HomeworkStatus = 'active' | 'submitted' | 'graded' | 'late' | 'missed';

export interface Homework {
  id:          string;
  subjectId:   string;
  groupId:     string | null;
  title:       string;
  description: string | null;
  dueDate:     string;
  maxScore:    number;
  fileUrl:     string | null;
  createdBy:   string;
  creator?:    { firstName: string; lastName: string };
  mySubmission?: HomeworkSubmission | null;
  streak?:     number;
  createdAt:   string;
}

export interface HomeworkSubmission {
  id:          string;
  homeworkId:  string;
  studentId:   string;
  fileUrl:     string | null;
  text:        string | null;
  score:       number | null;
  feedback:    string | null;
  submittedAt: string;
  gradedAt:    string | null;
  isLate:      boolean;
}

// ─── ILK QABUL (BASELINE) ────────────────────────────────────────────────────
export type BaselineType = 'test' | 'oral' | 'creative' | 'sport' | 'custom';

export interface BaselineAssessment {
  id:         string;
  studentId:  string;
  subjectId:  string;
  type:       BaselineType;
  score:      number | null;
  maxScore:   number;
  notes:      string | null;
  audioUrl:   string | null;
  fileUrl:    string | null;
  metadata:   Record<string, unknown>;
  assessedBy: string;
  assessor?:  { firstName: string; lastName: string };
  createdAt:  string;
  // Muhrlanadi — hech kim o'zgartira olmaydi
  isSealed:   true;
}

// ─── META ─────────────────────────────────────────────────────────────────────
export const MATERIAL_META: Record<MaterialType, { icon: string; label: string; color: string }> = {
  pdf:   { icon: '📄', label: 'PDF',    color: 'text-red-600'    },
  video: { icon: '🎬', label: 'Video',  color: 'text-blue-600'   },
  audio: { icon: '🎵', label: 'Audio',  color: 'text-purple-600' },
  link:  { icon: '🔗', label: 'Havola', color: 'text-emerald-600'},
  image: { icon: '🖼️', label: 'Rasm',   color: 'text-amber-600'  },
};

export const TEST_STATUS_META: Record<TestStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Qoralama',    color: 'text-gray-600',    bg: 'bg-gray-100'    },
  review:    { label: 'Tekshiruvda', color: 'text-amber-700',   bg: 'bg-amber-100'   },
  published: { label: 'Nashr',       color: 'text-emerald-700', bg: 'bg-emerald-100' },
  archived:  { label: 'Arxiv',       color: 'text-gray-500',    bg: 'bg-gray-100'    },
};

export const DIFFICULTY_META: Record<TestDifficulty, { label: string; color: string; bg: string }> = {
  easy:   { label: 'Oson',   color: 'text-green-700',   bg: 'bg-green-100'   },
  medium: { label: "O'rta",  color: 'text-amber-700',   bg: 'bg-amber-100'   },
  hard:   { label: 'Qiyin',  color: 'text-red-700',     bg: 'bg-red-100'     },
};

export const BASELINE_TYPE_META: Record<BaselineType, { label: string; icon: string }> = {
  test:     { label: 'Test',     icon: '📝' },
  oral:     { label: "Og'zaki",  icon: '🎤' },
  creative: { label: 'Ijodiy',   icon: '🎨' },
  sport:    { label: 'Sport',    icon: '🏃' },
  custom:   { label: 'Maxsus',   icon: '⭐' },
};

export function scoreToLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return DIFFICULTY_META.hard;
  if (score >= 60) return DIFFICULTY_META.medium;
  return DIFFICULTY_META.easy;
}

// ─── FAN ──────────────────────────────────────────────────────────────────────
// Backend Subject entity'da rang/ikonka yo'q (faqat iconUrl, odatda bo'sh) —
// vizual taqdimot uchun fan nomiga qarab deterministik ikonka/rang tanlanadi
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen, Calculator, Globe, Cpu, Atom, FlaskConical, Leaf, Landmark, GraduationCap,
  FileText, Film, Music, Link2, Image, Mic, Palette, Activity, Star,
} from 'lucide-react';

export interface SubjectStats {
  groups:         number;
  students:       number;
  materialsCount: number;
  testsCount:     number;
  homeworkCount:  number;
  avgScore:       number | null;
}

export interface Subject {
  id:          string;
  name:        string;
  description: string | null;
  iconUrl:     string | null;
  isActive:    boolean;
  sortOrder:   number;
  stats?:      SubjectStats;
}

const SUBJECT_VISUALS: { icon: LucideIcon; color: string }[] = [
  { icon: Globe,          color: '#3D5EE1' },
  { icon: Calculator,     color: '#F59E0B' },
  { icon: BookOpen,       color: '#EC4899' },
  { icon: Cpu,            color: '#8B5CF6' },
  { icon: Atom,           color: '#06B6D4' },
  { icon: FlaskConical,   color: '#10B981' },
  { icon: Leaf,           color: '#84CC16' },
  { icon: Landmark,       color: '#F97316' },
];

// Fan nomidan barqaror (har doim bir xil) ikonka+rang tanlaydi
export function getSubjectVisual(subject: Pick<Subject, 'id' | 'name'>): { icon: LucideIcon; color: string } {
  let hash = 0;
  for (let i = 0; i < subject.name.length; i++) hash = (hash * 31 + subject.name.charCodeAt(i)) >>> 0;
  return SUBJECT_VISUALS[hash % SUBJECT_VISUALS.length] ?? { icon: GraduationCap, color: '#6B7280' };
}

// ─── MATERIAL ─────────────────────────────────────────────────────────────────
export type MaterialType = 'pdf' | 'video' | 'audio' | 'image' | 'link' | 'other';

export interface Material {
  id:           string;
  title:        string;
  type:         MaterialType;
  fileUrl:      string;
  fileSize:     number | null;
  groupId:      string | null;
  group?:       { id: string; name: string; subjectId?: string };
  lessonId:     string | null;
  description:  string | null;
  uploadedById: string;
  uploadedBy?:  { firstName: string; lastName: string };
  isVisible:    boolean;
  createdAt:    string;
}

// ─── TEST ─────────────────────────────────────────────────────────────────────
export type TestStatus     = 'draft' | 'review' | 'published' | 'archived';
export type TestDifficulty = 'easy' | 'medium' | 'hard';
export type ScoreMethod    = 'best' | 'average' | 'last';

export interface Test {
  id:               string;
  title:            string;
  subjectId:        string;
  subject?:         { id: string; name: string };
  status:           TestStatus;
  description:      string | null;
  totalQuestions:   number;    // savollar havzasi hajmi
  questionsToShow:  number;    // har urinishda ko'rsatiladigan soni
  timeLimitMinutes: number;
  scoreMethod:      ScoreMethod;
  maxAttempts:      number;
  isBaseline:       boolean;
  createdById:      string;
  createdBy?:       { firstName: string; lastName: string };
  questionCount?:   number;    // faqat findOne() javobida
  myResult?:        TestResult | null;  // faqat talaba uchun findAll() javobida
  myAttemptsLeft?:  number;             // faqat talaba uchun findAll() javobida
  createdAt:        string;
}

export interface TestOption {
  id:   string;
  text: string;
}

// Staff ko'rinishi (to'g'ri javob bilan) — GET /tests/:id orqali
export interface TestQuestion {
  id:            string;
  testId:        string;
  question:      string;
  options:       TestOption[];
  correctAnswer: string;
  difficulty:    TestDifficulty;
  points:        number;
  imageUrl:      string | null;
  sortOrder:     number;
}

// Talaba ko'rinishi — POST /tests/:id/start orqali (to'g'ri javobsiz)
export interface TestTakeQuestion {
  id:         string;
  question:   string;
  options:    TestOption[];
  imageUrl:   string | null;
  difficulty: TestDifficulty;
}

export interface TestStartResponse {
  testResultId:     string;
  timeLimitMinutes: number;
  questionsCount:   number;
  questions:        TestTakeQuestion[];
  startedAt:        string;
}

export interface CheckAnswerResponse {
  correct:       boolean;
  correctAnswer: string;
}

export type ExtensionStatus = 'pending' | 'approved' | 'rejected';

export interface MyExtensionStatus {
  status:       ExtensionStatus | null;
  extraMinutes: number | null;
}

export interface PendingExtension {
  id:           string;
  testId:       string;
  testTitle:    string;
  studentId:    string;
  studentName:  string;
  extraMinutes: number;
  reason:       string | null;
  createdAt:    string;
}

export interface TestSubmitResponse {
  resultId:         string;
  score:            number;
  earnedPoints:     number;
  totalPoints:      number;
  timeSpentSeconds: number;
  level:            string;
  cheatingFlag:     boolean;
  checkedAnswers:   Record<string, { correct: boolean; correctAnswer: string }>;
  pointsEarned:     number;
}

// Saqlangan natija yozuvi (ro'yxatlarda: getResults / getStudentResults)
export interface TestResult {
  id:               string;
  testId:           string;
  test?:            { id: string; title: string; subject?: { id: string; name: string } };
  studentId:        string;
  student?:         { firstName: string; lastName: string };
  attemptNumber:    number;
  score:            number;
  totalPoints:      number;
  earnedPoints:     number;
  answers:          Record<string, string>;
  startedAt:        string;
  finishedAt:       string | null;
  timeSpentSeconds: number | null;
  cheatingFlag:     boolean;
  createdAt:        string;
}

// ─── VAZIFA ───────────────────────────────────────────────────────────────────
export type SubmissionStatus = 'submitted' | 'late' | 'graded' | 'resubmitted';

export interface Homework {
  id:             string;
  lessonId:       string;
  groupId:        string;
  group?:         { id: string; name: string; subjectId?: string };
  title:          string;
  description:    string | null;
  dueDate:        string;
  attachmentUrls: string[];
  maxScore:       number;
  createdAt:      string;
  mySubmission?:  HomeworkSubmission | null;
}

// Vazifa yaratishda tanlanadigan dars (GET /homework/lessons/:groupId)
export interface LessonOption {
  id:         string;
  lessonDate: string;
  startTime:  string;
  endTime:    string;
  topic:      string | null;
}

export interface HomeworkSubmission {
  id:             string;
  homeworkId:     string;
  studentId:      string;
  content:        string | null;
  fileUrls:       string[];
  status:         SubmissionStatus;
  isLate:         boolean;
  score:          number | null;
  teacherComment: string | null;
  gradedAt:       string | null;
  gradedById:     string | null;
  onTime:         boolean;
  submittedAt:    string;
}

// ─── ILK QABUL (BASELINE) ────────────────────────────────────────────────────
export type BaselineType = 'test' | 'oral' | 'creative' | 'sport' | 'custom';

export interface BaselineStudentOption {
  id:        string;
  firstName: string;
  lastName:  string;
}

export interface BaselineAssessment {
  id:           string;
  studentId:    string;
  subjectId:    string;
  subject?:     { id: string; name: string };
  type:         BaselineType;
  score:        number | null;
  audioUrl:     string | null;
  fileUrl:      string | null;
  sportData:    Record<string, number> | null;
  teacherScore: number | null;
  teacherNotes: string | null;
  assessedById: string;
  assessedBy?:  { firstName: string; lastName: string };
  sealedAt:     string | null;
  createdAt:    string;
}

// Muhrlanganmi — sealedAt asosida hisoblanadi (backendda alohida boolean yo'q)
export function isBaselineSealed(b: Pick<BaselineAssessment, 'sealedAt'>): boolean {
  return b.sealedAt !== null;
}

// ─── META ─────────────────────────────────────────────────────────────────────
export const MATERIAL_META: Record<MaterialType, { icon: LucideIcon; label: string; color: string }> = {
  pdf:   { icon: FileText, label: 'PDF',    color: 'text-red-600'    },
  video: { icon: Film,     label: 'Video',  color: 'text-blue-600'   },
  audio: { icon: Music,    label: 'Audio',  color: 'text-purple-600' },
  link:  { icon: Link2,    label: 'Havola', color: 'text-emerald-600'},
  image: { icon: Image,    label: 'Rasm',   color: 'text-amber-600'  },
  other: { icon: BookOpen, label: 'Fayl',   color: 'text-gray-600'   },
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

export const BASELINE_TYPE_META: Record<BaselineType, { label: string; icon: LucideIcon }> = {
  test:     { label: 'Test',     icon: FileText },
  oral:     { label: "Og'zaki",  icon: Mic },
  creative: { label: 'Ijodiy',   icon: Palette },
  sport:    { label: 'Sport',    icon: Activity },
  custom:   { label: 'Maxsus',   icon: Star },
};

// Ball (0-100) dan daraja meta'sini hisoblaydi — backend `level` satrini
// ham xuddi shu 60/80 chegaralari bilan hisoblaydi (tests.service.ts)
export function scoreToLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return DIFFICULTY_META.hard;
  if (score >= 60) return DIFFICULTY_META.medium;
  return DIFFICULTY_META.easy;
}

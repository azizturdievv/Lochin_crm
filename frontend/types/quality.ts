export type ErrorType = 'spelling' | 'grammar' | 'punctuation';

export interface SpellingCorrection {
  word:       string;
  correction: string;
  errorType:  ErrorType;
}

export interface SpellingLog {
  id:           string;
  userId:       string;
  user?:        { id: string; firstName: string; lastName: string; role: string; avatarUrl: string | null };
  originalText: string;
  correctedText:string;
  errorCount:   number;
  corrections:  SpellingCorrection[];
  roomId:       string | null;
  createdAt:    string;
}

export interface ProgressSnapshot {
  date:           string;
  subjectId:      string;
  subjectName:    string;
  score:          number;
  testCount:      number;
  attendanceRate: number;
}

export interface QualityStats {
  spellingErrorRate:   number;
  totalMessages:       number;
  errorMessages:       number;
  cleanMessages:       number;
  improvementPercent:  number | null;
  avgErrorsPerMessage: number;
  topErrors:           { word: string; correction: string; count: number }[];
  streakDays:          number;
}

export interface StudentQuality {
  studentId:    string;
  studentName:  string;
  role:         string;
  avatarUrl:    string | null;
  stats:        QualityStats;
  recentLogs:   SpellingLog[];
  progress:     ProgressSnapshot[];
}

// Rol bo'yicha filtr vazifalari
export type QualityView =
  | 'my_spelling'       // barcha rollar — o'z imlo xatolari
  | 'staff_spelling'    // SA — barcha xodim imlo
  | 'student_progress'  // SA/Manager/Ustoz — o'quvchi o'sishi
  | 'group_spelling'    // Ustoz — o'z guruhi imlo
  | 'child_progress';   // Ota-ona — farzand o'sishi

export const ERROR_TYPE_META: Record<ErrorType, { label: string; color: string }> = {
  spelling:    { label: 'Imlo',         color: 'text-red-600'    },
  grammar:     { label: 'Grammatika',   color: 'text-amber-600'  },
  punctuation: { label: 'Tinish belgi', color: 'text-blue-600'   },
};

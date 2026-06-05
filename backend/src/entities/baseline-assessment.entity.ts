import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Subject } from './subject.entity';

export enum AssessmentType {
  TEST = 'test',
  ORAL = 'oral',
  CREATIVE = 'creative',
  SPORT = 'sport',
  CUSTOM = 'custom',
}

// MUHIM: Bu jadval muhrlanadi — hech kim o'zgartira olmaydi (SA ham)
@Entity('baseline_assessments')
export class BaselineAssessment extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  @Column({ type: 'enum', enum: AssessmentType })
  type: AssessmentType;

  @Column({ name: 'score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number | null;

  // Audio yozuv URL (og'zaki uchun)
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;

  // Fayl URL (ijodiy uchun)
  @Column({ name: 'file_url', type: 'varchar', nullable: true })
  fileUrl: string | null;

  // Sport ko'rsatkichlari (JSON)
  @Column({ name: 'sport_data', type: 'jsonb', nullable: true })
  sportData: Record<string, number> | null;

  // Ustoz bahosi va izohi
  @Column({ name: 'teacher_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  teacherScore: number | null;

  @Column({ name: 'teacher_notes', nullable: true, type: 'text' })
  teacherNotes: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assessed_by' })
  assessedBy: User;

  @Column({ name: 'assessed_by' })
  assessedById: string;

  // Muhrlash sanasi — keyinroq o'zgartirib bo'lmaydi
  @Column({ name: 'sealed_at', type: 'timestamptz', nullable: true })
  sealedAt: Date | null;
}

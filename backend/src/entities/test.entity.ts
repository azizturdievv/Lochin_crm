import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';

export enum TestStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum TestDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('tests')
export class Test extends BaseEntity {
  @Column({ length: 200 })
  title: string;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject: Subject;

  @Column({ name: 'subject_id' })
  subjectId: string;

  // Draft qilgan ustoz
  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: string;

  @Column({ type: 'enum', enum: TestStatus, default: TestStatus.DRAFT })
  status: TestStatus;

  // Umumiy savol soni va tanlash soni
  @Column({ name: 'total_questions', default: 30 })
  totalQuestions: number;

  @Column({ name: 'questions_to_show', default: 10 })
  questionsToShow: number;

  // Vaqt limiti (daqiqada)
  @Column({ name: 'time_limit_minutes', default: 30 })
  timeLimitMinutes: number;

  // Ball hisoblash usuli: best, average, last
  @Column({ name: 'score_method', default: 'best' })
  scoreMethod: string;

  // Qayta urinish soni (0 = cheksiz)
  @Column({ name: 'max_attempts', default: 3 })
  maxAttempts: number;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // Baseline (ilk qabul) testi — muhrlanadi
  @Column({ name: 'is_baseline', default: false })
  isBaseline: boolean;
}

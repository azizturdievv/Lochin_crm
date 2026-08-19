import { Entity, Column, ManyToOne, ManyToMany, JoinColumn, JoinTable, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Subject } from './subject.entity';
import { User } from './user.entity';
import { Group } from './group.entity';

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

  // Nazorat ishi rejimi: false bo'lsa, o'quvchi o'z natijasini (ball va
  // savol-savol batafsil) resultsReleasedAt belgilanmaguncha ko'ra olmaydi.
  // Default true — oddiy mashq testlari hozirgidek darhol natija ko'rsatadi
  @Column({ name: 'results_auto_visible', default: true })
  resultsAutoVisible: boolean;

  // SA/Manager/ustoz "Natijalarni ochish" bosganda to'ldiriladi
  @Column({ name: 'results_released_at', type: 'timestamptz', nullable: true })
  resultsReleasedAt: Date | null;

  // Daraja tegi — erkin matn (Beginner, A1, B1, B2, ...), test bazasini
  // qo'lda saralash uchun. Cheklangan enum emas — markaz o'zi xohlagan
  // daraja nomlarini ishlatishi mumkin
  @Column({ type: 'varchar', nullable: true, length: 50 })
  level: string | null;

  // Bo'sh bo'lsa — fanning barcha guruhiga ko'rinadi (eski xatti-harakat).
  // To'ldirilsa — FAQAT shu guruhlarga ko'rinadi (masalan daraja bo'yicha
  // maqsadli test tayinlash uchun)
  @ManyToMany(() => Group)
  @JoinTable({
    name: 'test_group_visibility',
    joinColumn: { name: 'test_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'group_id', referencedColumnName: 'id' },
  })
  visibleGroups: Group[];
}

import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Test } from './test.entity';
import { User } from './user.entity';

// DB darajasida ikki tenglashuvchi so'rov bir xil urinish raqamini yarata
// olmasligini kafolatlaydi (startTest'dagi "tekshir-keyin-yoz" poyga holatiga
// qarshi so'nggi himoya chizig'i)
@Entity('test_results')
@Unique(['testId', 'studentId', 'attemptNumber'])
export class TestResult extends BaseEntity {
  @ManyToOne(() => Test)
  @JoinColumn({ name: 'test_id' })
  test: Test;

  @Column({ name: 'test_id' })
  testId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'attempt_number', default: 1 })
  attemptNumber: number;

  @Column({ name: 'score', type: 'decimal', precision: 5, scale: 2 })
  score: number;

  @Column({ name: 'total_points', default: 0 })
  totalPoints: number;

  @Column({ name: 'earned_points', default: 0 })
  earnedPoints: number;

  // Javoblar tarixi (JSON)
  @Column({ name: 'answers', type: 'jsonb', default: {} })
  answers: Record<string, string>;

  // Shu urinishda o'quvchiga ko'rsatilgan savollar (random tanlangan to'plam) —
  // checkAnswer/submitTest shu ro'yxatdan tashqari savolni qabul qilmasligi kerak
  @Column({ name: 'selected_question_ids', type: 'jsonb', default: [] })
  selectedQuestionIds: string[];

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', nullable: true, type: 'timestamptz' })
  finishedAt: Date | null;

  // Ketgan vaqt (soniyada) — AI anti-cheat uchun
  @Column({ name: 'time_spent_seconds', type: 'int', nullable: true })
  timeSpentSeconds: number | null;

  // AI anti-cheat bayrog'i
  @Column({ name: 'cheating_flag', default: false })
  cheatingFlag: boolean;

  // Nazorat ishida boshqa tab/oynaga chiqib ketishlar soni (jonli kuzatuv uchun)
  @Column({ name: 'tab_switch_count', default: 0 })
  tabSwitchCount: number;
}

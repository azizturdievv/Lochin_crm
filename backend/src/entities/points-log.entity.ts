import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum PointsAction {
  // O'quvchi ballari
  CORRECT_MESSAGE = 'correct_message',
  SELF_CORRECT = 'self_correct',
  BOOK_PASSED = 'book_passed',
  TEST_HIGH_SCORE = 'test_high_score',
  // Xodim ballari
  SPELLING_CORRECT = 'spelling_correct',
  DUTY_DONE = 'duty_done',
  KPI_100 = 'kpi_100',
  NEW_STUDENT = 'new_student',
  // Jazo
  SPELLING_ERROR = 'spelling_error',
  DUTY_MISSED = 'duty_missed',
  // Boshqa
  MANUAL = 'manual',
}

@Entity('points_log')
export class PointsLog extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: PointsAction })
  action: PointsAction;

  @Column({ type: 'int' })
  points: number;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // Ballar tegishli bo'lgan manba (testId, bookId va h.k.)
  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null;

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;
}

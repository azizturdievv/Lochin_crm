import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Test } from './test.entity';
import { User } from './user.entity';

// SA/Manager/Ustoz tomonidan o'quvchiga qo'shimcha urinish berilishi
// (masalan, birinchi urinishni shoshilib/tasodifan tugatgan bo'lsa)
@Entity('test_attempt_grants')
export class TestAttemptGrant extends BaseEntity {
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

  @Column({ name: 'extra_attempts', default: 1 })
  extraAttempts: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by' })
  grantedBy: User;

  @Column({ name: 'granted_by' })
  grantedById: string;
}

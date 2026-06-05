import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('installment_plans')
export class InstallmentPlan extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ name: 'total_amount', type: 'bigint' })
  totalAmount: bigint;

  // 2, 3, 4 qism
  @Column({ name: 'parts_count' })
  partsCount: number;

  @Column({ name: 'paid_parts', default: 0 })
  paidParts: number;

  // Har bir qism uchun to'lov jadvali (JSON)
  @Column({ name: 'schedule', type: 'jsonb' })
  schedule: { part: number; amount: bigint; dueDate: string; paidAt?: string }[];

  @Column({ name: 'description', nullable: true, type: 'text' })
  description: string | null;

  @Column({ name: 'is_completed', default: false })
  isCompleted: boolean;
}

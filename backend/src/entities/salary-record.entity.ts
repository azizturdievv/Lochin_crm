import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum SalaryRecordStatus {
  CALCULATED = 'calculated',
  APPROVED = 'approved',
  PAID = 'paid',
}

@Entity('salary_records')
export class SalaryRecord extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  // Oy: YYYY-MM formatida
  @Column({ name: 'period_month', length: 7 })
  periodMonth: string;

  @Column({ name: 'base_amount', type: 'bigint' })
  baseAmount: bigint;

  @Column({ name: 'kpi_bonus', type: 'bigint', default: 0 })
  kpiBonus: bigint;

  // O'rinbosar sababli qo'shilgan miqdor
  @Column({ name: 'sub_amount', type: 'bigint', default: 0 })
  subAmount: bigint;

  // Asosiy o'qituvchi joyida o'rinbosar ishlasa chegiriladi
  @Column({ name: 'deduction', type: 'bigint', default: 0 })
  deduction: bigint;

  @Column({ name: 'total_amount', type: 'bigint' })
  totalAmount: bigint;

  @Column({ name: 'lessons_count', default: 0 })
  lessonsCount: number;

  @Column({ name: 'total_hours', type: 'decimal', precision: 6, scale: 1, default: 0 })
  totalHours: number;

  @Column({ type: 'enum', enum: SalaryRecordStatus, default: SalaryRecordStatus.CALCULATED })
  status: SalaryRecordStatus;

  // SA tomonidan tasdiqlangan
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  @Column({ name: 'approved_by', type: 'varchar', nullable: true })
  approvedById: string | null;

  @Column({ name: 'approved_at', nullable: true, type: 'timestamptz' })
  approvedAt: Date | null;

  @Column({ name: 'paid_at', nullable: true, type: 'timestamptz' })
  paidAt: Date | null;
}

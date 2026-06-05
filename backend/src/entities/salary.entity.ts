import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

// AES-256 bilan shifrlanadigan ma'lumotlar (CLAUDE.md talabi)
@Entity('salaries')
export class Salary extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  // Ustoz foiz stavkasi: 15-18%
  @Column({ name: 'rate_percent', type: 'decimal', precision: 5, scale: 2 })
  ratePercent: number;

  // KPI bonus foizi
  @Column({ name: 'kpi_bonus_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  kpiBonusPercent: number;

  // Admin uchun: soatlik stavka
  @Column({ name: 'hourly_rate', type: 'bigint', nullable: true })
  hourlyRate: bigint | null;

  // Savdo bonusi (admin uchun)
  @Column({ name: 'sales_bonus_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  salesBonusPercent: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'started_at', type: 'date' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'date', nullable: true })
  endedAt: Date | null;
}

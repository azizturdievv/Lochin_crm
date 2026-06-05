import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('duty_schedule')
export class DutySchedule extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'duty_date', type: 'date' })
  dutyDate: Date;

  @Column({ name: 'completed', default: false })
  completed: boolean;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamptz' })
  completedAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  // Ball berildi (+5 yoki -10)
  @Column({ name: 'points_awarded', default: false })
  pointsAwarded: boolean;
}

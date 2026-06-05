import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Subject } from './subject.entity';

@Entity('progress_snapshots')
export class ProgressSnapshot extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @ManyToOne(() => Subject, { nullable: true })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject | null;

  @Column({ name: 'subject_id', type: 'varchar', nullable: true })
  subjectId: string | null;

  // Grafik uchun ma'lumotlar (JSON)
  @Column({ name: 'metrics', type: 'jsonb' })
  metrics: {
    attendanceRate: number;
    avgTestScore: number;
    homeworkCompletion: number;
    totalPoints: number;
    spellingErrors: number;
  };

  @Column({ name: 'snapshot_date', type: 'date' })
  snapshotDate: Date;

  // Oylik snapshot yoki haftalik
  @Column({ name: 'period_type', default: 'monthly' })
  periodType: string;
}

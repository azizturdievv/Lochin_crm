import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { AbsenceReason } from './lesson-substitution.entity';

@Entity('teacher_absences')
export class TeacherAbsence extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'teacher_id' })
  teacher: User;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ name: 'absence_date', type: 'date' })
  absenceDate: Date;

  @Column({ type: 'enum', enum: AbsenceReason })
  reason: AbsenceReason;

  @Column({ nullable: true, type: 'text' })
  notes: string | null;

  // Hujjat URL (kasallik varag'i va h.k.)
  @Column({ name: 'document_url', type: 'varchar', nullable: true })
  documentUrl: string | null;

  @Column({ name: 'approved', default: false })
  approved: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User | null;

  @Column({ name: 'approved_by', type: 'varchar', nullable: true })
  approvedById: string | null;
}

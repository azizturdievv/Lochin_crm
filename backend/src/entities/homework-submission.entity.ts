import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Homework } from './homework.entity';
import { User } from './user.entity';

export enum SubmissionStatus {
  SUBMITTED = 'submitted',
  LATE = 'late',
  GRADED = 'graded',
  RESUBMITTED = 'resubmitted',
}

@Entity('homework_submissions')
@Index(['homeworkId', 'studentId'], { unique: true })
export class HomeworkSubmission extends BaseEntity {
  @ManyToOne(() => Homework, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id' })
  homework: Homework;

  @Column({ name: 'homework_id' })
  homeworkId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id' })
  studentId: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  // Yuklangan fayllar (MinIO URL'lar)
  @Column({ name: 'file_urls', type: 'jsonb', default: [] })
  fileUrls: string[];

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.SUBMITTED })
  status: SubmissionStatus;

  // Kechikib topshirildimi
  @Column({ name: 'is_late', default: false })
  isLate: boolean;

  // Ustoz bahosi (0-100)
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number | null;

  @Column({ name: 'teacher_comment', type: 'text', nullable: true })
  teacherComment: string | null;

  @Column({ name: 'graded_at', type: 'timestamptz', nullable: true })
  gradedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'graded_by' })
  gradedBy: User | null;

  @Column({ name: 'graded_by', type: 'varchar', nullable: true })
  gradedById: string | null;

  // Streak hisoblash uchun: o'z vaqtida topshirildimi
  @Column({ name: 'on_time', default: true })
  onTime: boolean;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt: Date;
}
